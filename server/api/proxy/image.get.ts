import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { lookup as dnsLookup } from 'node:dns'
import http from 'node:http'
import https from 'node:https'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_CONCURRENT_IMAGE_FETCHES = 30
const MAX_REDIRECTS = 5
let activeImageFetches = 0

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
  if (h.endsWith('.musicapp.migu.cn') || h.endsWith('.migu.cn')) return 'https://y.migu.cn/'
  return ''
}

// 连接时 DNS 校验：作为 http/https 请求的自定义 lookup，确保实际连接的 IP 与校验的 IP 一致，
// 彻底关闭 DNS 重绑定（DNS Rebinding）窗口
const secureLookup = (hostname, options, callback) => {
  dnsLookup(hostname, options, (err, address, family) => {
    if (err) {
      callback(err)
      return
    }
    const resolved = Array.isArray(address) ? address : [{ address, family }]
    for (const item of resolved) {
      if (isBlockedAddress(item.address)) {
        callback(new Error('该域名解析到内网地址，不允许代理'))
        return
      }
    }
    callback(null, address, family)
  })
}

// 发起单次请求（不自动跟随重定向），连接层使用 secureLookup 校验 IP
const requestOnce = (targetUrl, headers, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl)
    const client = url.protocol === 'https:' ? https : http
    const req = client.request(
      targetUrl,
      { method: 'GET', headers, lookup: secureLookup },
      (res) => resolve(res)
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('图片请求超时'))
    })
    req.end()
  })
}

const fetchImage = async (imageUrl) => {
  let currentUrl = imageUrl

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const url = new URL(currentUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('不支持的协议')
    }

    // 每一跳连接前都先校验（直连 IP / localhost / 域名预解析）
    await validateUrl(url)

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: getReferer(url.hostname) || url.origin
    }

    const res = await requestOnce(currentUrl, headers, 15000)
    const status = res.statusCode || 0

    // 手动处理重定向：下一跳目标会在循环顶部重新校验，避免自动跟随造成的 SSRF
    if (status >= 300 && status < 400 && res.headers.location) {
      res.destroy()
      if (redirect === MAX_REDIRECTS) {
        throw new Error('重定向次数过多')
      }
      currentUrl = new URL(res.headers.location, currentUrl).toString()
      continue
    }

    if (status !== 200) {
      res.destroy()
      throw new Error(`图片请求失败: HTTP ${status}`)
    }

    const contentType = res.headers['content-type'] || ''
    if (!contentType.startsWith('image/')) {
      res.destroy()
      throw new Error('响应不是图片类型')
    }

    const contentLength = Number(res.headers['content-length'] || 0)
    if (contentLength > MAX_IMAGE_BYTES) {
      res.destroy()
      throw createError({ statusCode: 413, message: '图片文件过大' })
    }

    // 流式读取，防止恶意服务器通过缺失或伪造 content-length 导致内存耗尽
    let loaded = 0
    const chunks = []
    for await (const chunk of res) {
      loaded += chunk.length
      if (loaded > MAX_IMAGE_BYTES) {
        res.destroy()
        throw createError({ statusCode: 413, message: '图片文件过大' })
      }
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    return { contentType, buffer }
  }

  throw new Error('重定向次数过多')
}

const retryFetchImage = async (imageUrl, maxRetries = 2) => {
  let lastError
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetchImage(imageUrl)
    } catch (err) {
      lastError = err
      // 校验层面错误（400/403）重试无意义，直接中断
      if (
        err &&
        typeof err === 'object' &&
        'statusCode' in err &&
        (err.statusCode === 400 || err.statusCode === 403)
      ) {
        throw err
      }
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

  if (activeImageFetches >= MAX_CONCURRENT_IMAGE_FETCHES) {
    throw createError({ statusCode: 429, message: '图片代理请求过多，请稍后重试' })
  }

  activeImageFetches++

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
  } finally {
    activeImageFetches = Math.max(0, activeImageFetches - 1)
  }
})
