import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_REDIRECTS = 5

interface ValidatedImageTarget {
  address: string
  family: 4 | 6
}

interface ImageFetchResult {
  headers: http.IncomingHttpHeaders
  statusCode: number
  statusMessage: string
  body: Buffer
}

const isBlockedIPv4 = (address: string) => {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true
  }

  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0) ||
    first >= 224
  )
}

const isBlockedIPv6 = (address: string) => {
  const normalizedAddress = address.toLowerCase()
  if (normalizedAddress.startsWith('::ffff:')) {
    return isBlockedIPv4(normalizedAddress.replace('::ffff:', ''))
  }

  return !normalizedAddress.startsWith('2') && !normalizedAddress.startsWith('3')
}

const isBlockedAddress = (address: string) => {
  const ipVersion = isIP(address)
  if (ipVersion === 4) {
    return isBlockedIPv4(address)
  }
  if (ipVersion === 6) {
    return isBlockedIPv6(address)
  }
  return true
}

const normalizeHostname = (hostname: string) => hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const getErrorName = (error: unknown) => {
  if (error instanceof Error) {
    return error.name
  }
  return ''
}

const getErrorCode = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : ''
  }
  return ''
}

const getErrorCause = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'cause' in error) {
    return (error as { cause?: unknown }).cause
  }
  return undefined
}

const isHttpError = (error: unknown): error is { statusCode: number } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  )
}

const validatePublicImageTarget = async (url: URL): Promise<ValidatedImageTarget> => {
  if (url.username || url.password) {
    throw createError({
      statusCode: 400,
      message: '图片URL不能包含用户名或密码'
    })
  }

  const hostname = normalizeHostname(url.hostname)
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw createError({
      statusCode: 403,
      message: '不允许代理本机地址'
    })
  }

  const hostAddressType = isIP(hostname)
  if (hostAddressType && isBlockedAddress(hostname)) {
    throw createError({
      statusCode: 403,
      message: '不允许代理内网地址'
    })
  }

  const addresses: ValidatedImageTarget[] = hostAddressType
    ? [{ address: hostname, family: hostAddressType }]
    : await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw createError({
      statusCode: 403,
      message: '不允许代理内网地址'
    })
  }

  // 优先使用 IPv4 地址，避免 IPv6 连接因网络环境不支持而失败
  addresses.sort((a, b) => {
    if (a.family === 4 && b.family !== 4) return -1
    if (a.family !== 4 && b.family === 4) return 1
    return 0
  })
  return addresses[0]
}

const getRefererForHost = (hostname: string) => {
  const normalizedHost = hostname.toLowerCase()
  if (normalizedHost === 'hdslb.com' || normalizedHost.endsWith('.hdslb.com')) {
    return 'https://www.bilibili.com/'
  }
  if (
    normalizedHost === 'y.qq.com' ||
    normalizedHost.endsWith('.y.qq.com') ||
    normalizedHost === 'y.gtimg.cn' ||
    normalizedHost.endsWith('.y.gtimg.cn')
  ) {
    return 'https://y.qq.com/'
  }
  if (normalizedHost === 'music.126.net' || normalizedHost.endsWith('.music.126.net')) {
    return 'https://music.163.com/'
  }
  return ''
}

const makeSingleRequest = (
  url: URL,
  target: ValidatedImageTarget,
  headers: Record<string, string>
): Promise<ImageFetchResult> => {
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
        headers,
        lookup: (_hostname, _options, callback) => {
          callback(null, target.address, target.family)
        }
      },
      (response) => {
        const chunks: Buffer[] = []
        let totalBytes = 0

        response.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length
          if (totalBytes > MAX_IMAGE_BYTES) {
            request.destroy(
              createError({
                statusCode: 413,
                message: '图片文件过大'
              })
            )
            return
          }
          chunks.push(chunk)
        })

        response.on('end', () => {
          resolve({
            headers: response.headers,
            statusCode: response.statusCode || 0,
            statusMessage: response.statusMessage || '',
            body: Buffer.concat(chunks)
          })
        })
      }
    )

    request.setTimeout(10000, () => {
      request.destroy(Object.assign(new Error('Request timeout'), { code: 'ETIMEDOUT' }))
    })
    request.on('error', reject)
    request.end()
  })
}

// 发送带 DNS 固定的请求，并自动跟随 HTTP 重定向
const fetchImageWithPinnedAddress = async (
  url: URL,
  target: ValidatedImageTarget,
  headers: Record<string, string>,
  redirectCount = 0
): Promise<ImageFetchResult> => {
  const result = await makeSingleRequest(url, target, headers)

  // 处理 HTTP 重定向（301/302/307/308）
  if (result.statusCode >= 300 && result.statusCode < 400 && result.headers.location) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error('图片请求重定向次数过多')
    }

    const rawLocation = result.headers.location
    const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation
    const newUrl = new URL(location, url)

    // 只允许 http/https 协议
    if (newUrl.protocol !== 'http:' && newUrl.protocol !== 'https:') {
      throw createError({
        statusCode: 400,
        message: '重定向目标协议无效'
      })
    }

    // 重新验证新目标地址
    const newTarget = await validatePublicImageTarget(newUrl)
    const newReferer = getRefererForHost(newUrl.hostname) || newUrl.origin
    const newHeaders = { ...headers, Referer: newReferer }

    return fetchImageWithPinnedAddress(newUrl, newTarget, newHeaders, redirectCount + 1)
  }

  return result
}

const fetchWithRetry = async (
  url: URL,
  target: ValidatedImageTarget,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<ImageFetchResult> => {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`尝试获取图片 (${attempt}/${maxRetries}): ${url.href}`)
      const response = await fetchImageWithPinnedAddress(url, target, headers)

      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`图片获取成功 (尝试 ${attempt})`)
        return response
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
      }
    } catch (error: unknown) {
      lastError = error
      console.warn(`图片获取失败 (尝试 ${attempt}/${maxRetries}):`, getErrorMessage(error))

      // 如果不是最后一次尝试，等待一段时间后重试
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // 指数退避，最大5秒
        console.log(`等待 ${delay}ms 后重试...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imageUrl = query.url as string

  if (!imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Missing image URL parameter'
    })
  }

  try {
    // 验证URL是否为有效的图片URL
    const url = new URL(imageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol')
    }

    const validatedTarget = await validatePublicImageTarget(url)

    // 第三方音乐封面通常需要来源站点 Referer 才能稳定访问
    const referer = getRefererForHost(url.hostname) || url.origin

    // 优化的请求头
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      Referer: referer
    }

    // 使用重试机制获取图片
    const response = await fetchWithRetry(url, validatedTarget, headers)

    // 检查内容类型
    const rawContentType = response.headers['content-type']
    const contentType = Array.isArray(rawContentType) ? rawContentType[0] : rawContentType
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('Response is not an image')
    }
    if (contentType.toLowerCase().includes('svg')) {
      throw createError({
        statusCode: 415,
        message: '不支持代理 SVG 图片'
      })
    }

    const rawContentLength = response.headers['content-length']
    const contentLength = Number(
      Array.isArray(rawContentLength) ? rawContentLength[0] : rawContentLength || 0
    )
    if (contentLength > MAX_IMAGE_BYTES) {
      throw createError({
        statusCode: 413,
        message: '图片文件过大'
      })
    }

    // 获取图片数据
    const imageBuffer = response.body
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      throw createError({
        statusCode: 413,
        message: '图片文件过大'
      })
    }

    // 设置响应头
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=3600') // 缓存1小时
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
    setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')

    console.log(`图片代理成功: ${imageUrl}, 大小: ${imageBuffer.length} bytes`)
    return new Uint8Array(imageBuffer)
  } catch (error: unknown) {
    if (isHttpError(error)) {
      throw error
    }

    console.error('Image proxy error:', {
      url: imageUrl,
      error: getErrorMessage(error),
      code: getErrorCode(error),
      cause: getErrorCause(error)
    })

    // 提供更详细的错误信息
    let errorMessage = 'Failed to fetch image'
    const errorCode = getErrorCode(error)
    if (errorCode === 'ECONNRESET') {
      errorMessage = '网络连接被重置，请稍后重试'
    } else if (errorCode === 'ETIMEDOUT' || getErrorName(error) === 'AbortError') {
      errorMessage = '请求超时，请检查网络连接'
    } else if (errorCode === 'ENOTFOUND') {
      errorMessage = '无法解析域名，请检查URL是否正确'
    } else if (getErrorMessage(error).includes('HTTP')) {
      errorMessage = `服务器返回错误: ${getErrorMessage(error)}`
    }

    throw createError({
      statusCode: 500,
      message: `${errorMessage}: ${getErrorMessage(error)}`
    })
  }
})
