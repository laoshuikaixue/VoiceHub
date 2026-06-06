import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const isBlockedIPv4 = (address) => {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
  const [first, second] = parts
  return (
    first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0) ||
    first >= 224
  )
}

const isBlockedIPv6 = (address) => {
  const n = address.toLowerCase()
  // IPv4-mapped IPv6
  if (n.startsWith('::ffff:')) return isBlockedIPv4(n.replace('::ffff:', ''))
  // ::1 (loopback)
  if (n === '::1') return true
  // fe80::/10 (link-local)
  if (n.startsWith('fe8') || n.startsWith('fe9') || n.startsWith('fea') || n.startsWith('feb')) return true
  // fc00::/7 (unique local)
  if (n.startsWith('fc') || n.startsWith('fd')) return true
  return false
}

const isBlockedAddress = (address) => {
  const ver = isIP(address)
  if (ver === 4) return isBlockedIPv4(address)
  if (ver === 6) return isBlockedIPv6(address)
  return true
}

const validateUrl = async (url) => {
  if (url.username || url.password) {
    throw createError({ statusCode: 400, message: '图片URL不能包含用户名或密码' })
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw createError({ statusCode: 403, message: '不允许代理本机地址' })
  }

  // 如果是直接IP → 直接检查
  const directIp = isIP(hostname)
  if (directIp && isBlockedAddress(hostname)) {
    throw createError({ statusCode: 403, message: '不允许代理内网地址' })
  }

  // 域名 → DNS解析后检查
  if (!directIp) {
    const addrs = await lookup(hostname, { all: true })
    for (const addr of addrs) {
      if (isBlockedAddress(addr.address)) {
        throw createError({ statusCode: 403, message: '该域名解析到内网地址，不允许代理' })
      }
    }
  }
}

const getReferer = (hostname) => {
  const h = hostname.toLowerCase()
  if (h === 'hdslb.com' || h.endsWith('.hdslb.com')) return 'https://www.bilibili.com/'
  if (h === 'y.qq.com' || h.endsWith('.y.qq.com') || h === 'y.gtimg.cn' || h.endsWith('.y.gtimg.cn')) return 'https://y.qq.com/'
  if (h === 'music.126.net' || h.endsWith('.music.126.net')) return 'https://music.163.com/'
  return ''
}

const fetchImage = async (imageUrl) => {
  const url = new URL(imageUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('不支持的协议')
  }

  await validateUrl(url)

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
    Referer: getReferer(url.hostname) || url.origin
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(imageUrl, {
      headers,
      signal: controller.signal,
      redirect: 'follow'
    })

    // 二次校验：防止重定向到内网或非法地址
    const finalUrl = new URL(response.url)
    await validateUrl(finalUrl)

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      response.body?.cancel()
      throw new Error('响应不是图片类型')
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_IMAGE_BYTES) {
      response.body?.cancel()
      throw createError({ statusCode: 413, message: '图片文件过大' })
    }

    // 流式读取，防止恶意服务器通过缺失或伪造 content-length 导致内存耗尽
    if (!response.body) {
      throw new Error('响应体为空')
    }
    let loaded = 0
    const chunks = []
    for await (const chunk of response.body as any) {
      loaded += chunk.length
      if (loaded > MAX_IMAGE_BYTES) {
        throw createError({ statusCode: 413, message: '图片文件过大' })
      }
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    return { contentType, buffer }
  } finally {
    clearTimeout(timeout)
  }
}

const retryFetchImage = async (imageUrl, maxRetries = 2) => {
  let lastError
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetchImage(imageUrl)
    } catch (err) {
      lastError = err
      if (i < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
      }
    }
  }
  throw lastError
}

export default defineEventHandler(async (event) => {
  const imageUrl = getQuery(event).url

  if (!imageUrl) throw createError({ statusCode: 400, message: '缺少图片URL参数' })

  try {
    const { contentType, buffer } = await retryFetchImage(imageUrl)

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=3600')
    setHeader(event, 'Access-Control-Allow-Origin', '*')

    return new Uint8Array(buffer)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error

    console.error('图片代理失败:', imageUrl, error)

    throw createError({
      statusCode: 500,
      message: `图片获取失败: ${error?.message || '未知错误'}`
    })
  }
})