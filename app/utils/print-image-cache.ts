/**
 * 打印导出用图片下载缓存。
 *
 * 模块级缓存（URL -> dataURL 的 Promise），跨组件卸载存活：
 * - 以 Promise 为缓存值，天然实现 in-flight 去重（并发调用共享同一请求）
 * - 失败（null）不缓存，允许后续重试
 * - FIFO 上限，防止 base64 长期驻留内存
 */

const MAX_CACHE_ENTRIES = 200

const cache = new Map<string, Promise<string | null>>()

const isPrivateIPv4 = (hostname: string): boolean => {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  const [first, second] = parts
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

const isPrivateIPv6 = (hostname: string): boolean => {
  const normalizedHost = hostname.toLowerCase()
  return (
    normalizedHost === '::1' ||
    normalizedHost.startsWith('fc') ||
    normalizedHost.startsWith('fd') ||
    normalizedHost.startsWith('fe8') ||
    normalizedHost.startsWith('fe9') ||
    normalizedHost.startsWith('fea') ||
    normalizedHost.startsWith('feb')
  )
}

const shouldFetchImageDirectly = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url, window.location.origin)
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
    return (
      parsedUrl.origin === window.location.origin ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.internal') ||
      isPrivateIPv4(hostname) ||
      isPrivateIPv6(hostname)
    )
  } catch {
    return true
  }
}

const fetchImageBlob = async (url: string, useProxy: boolean): Promise<Blob> => {
  const targetUrl = useProxy ? `/api/proxy/image?url=${encodeURIComponent(url)}` : url
  const response = await fetch(targetUrl)
  if (!response.ok) {
    throw new Error(useProxy ? '图片代理下载失败' : '图片直连下载失败')
  }
  return response.blob()
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const fetchAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const directFirst = shouldFetchImageDirectly(url)
    let blob: Blob
    try {
      blob = await fetchImageBlob(url, !directFirst)
    } catch (error) {
      if (directFirst) throw error
      // 代理拒绝内网解析时，交给浏览器按用户网络环境直连
      blob = await fetchImageBlob(url, false)
    }
    return await blobToDataUrl(blob)
  } catch (error) {
    console.warn('图片下载失败:', url, error)
    return null
  }
}

const evictIfNeeded = () => {
  // Map 迭代顺序即插入顺序，淘汰最旧条目
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/**
 * 下载图片并转为 base64 dataURL（带缓存）。
 * @param url 原始图片地址（即 img.dataset.originalSrc）
 */
export const downloadImageAsBase64 = (url: string): Promise<string | null> => {
  if (!url) return Promise.resolve(null)
  // 已经是 dataURL 的直接返回，避免误走代理
  if (url.startsWith('data:')) return Promise.resolve(url)
  const cached = cache.get(url)
  if (cached) return cached
  const promise = fetchAsDataUrl(url)
  cache.set(url, promise)
  promise.then((result) => {
    if (result === null) {
      cache.delete(url)
    } else {
      evictIfNeeded()
    }
  })
  return promise
}

/**
 * 批量预热缓存：去重后按并发预取，供批量导出前一次性拉齐全部封面/Logo。
 */
export const warmupPrintImages = async (urls: string[], concurrency = 6): Promise<void> => {
  const unique = Array.from(new Set(urls.filter(Boolean)))
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (cursor < unique.length) {
      const url = unique[cursor]
      cursor += 1
      await downloadImageAsBase64(url)
    }
  })
  await Promise.all(workers)
}
