/**
 * 将HTTP URL转换为HTTPS
 * @param url - 要转换的URL
 * @returns 转换后的HTTPS URL
 */
export const convertToHttps = (url: string | null | undefined): string => {
  if (!url) return url || ''
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}

// 背景渲染仅用于取色（渲染器内部会降采样到 32×32）与 60px 模糊，收敛到小图即可，
// 与 QQ 音乐封面缩略图（T002R300x300M000）取同一口径
const COVER_SIZE = 300

// 网易云图片 CDN：param=边长y边长 做正方形裁切缩放
const NETEASE_IMAGE_HOSTS = ['music.126.net']

// QQ 音乐图片 CDN：尺寸写在文件名里（T002R500x500M000{albumMid}.jpg），不认 query 缩放参数
const QQ_IMAGE_HOSTS = ['y.gtimg.cn', 'y.qq.com']
const QQ_IMAGE_SIZE_PATTERN = /(T\d{3})R(\d+)x(\d+)M000/

const matchHost = (host: string, hosts: string[]): boolean =>
  hosts.some((item) => host === item || host.endsWith(`.${item}`))

/**
 * 按需收敛封面URL的尺寸，避免背景渲染加载超大原图
 *
 * 网易云部分专辑原图可达 10MB 以上，超过图片代理的体积上限会被拒绝加载。
 * 网易云与 QQ 音乐可做尺寸收敛；其余来源（如咪咕 CDN 不提供缩放参数）原样返回，
 * 由图片代理的体积上限配合背景渲染的降级兜底保证不出现空白背景。
 * @param url - 封面URL
 * @param size - 期望边长（像素）
 * @returns 收敛尺寸后的URL；不支持尺寸控制的来源原样返回
 */
export const getSizedCoverUrl = (url: string | null | undefined, size = COVER_SIZE): string => {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (matchHost(host, NETEASE_IMAGE_HOSTS)) {
      if (parsed.searchParams.has('param')) return url
      parsed.searchParams.set('param', `${size}y${size}`)
      return parsed.toString()
    }

    if (matchHost(host, QQ_IMAGE_HOSTS)) {
      const matched = QQ_IMAGE_SIZE_PATTERN.exec(parsed.pathname)
      if (!matched) return url
      // 只收敛不放大，已足够小的地址保持原样
      const currentSize = Number(matched[2])
      if (!Number.isFinite(currentSize) || currentSize <= size) return url
      parsed.pathname = parsed.pathname.replace(QQ_IMAGE_SIZE_PATTERN, `$1R${size}x${size}M000`)
      return parsed.toString()
    }

    return url
  } catch {
    return url
  }
}

/**
 * 验证URL格式是否有效
 * @param url - 要验证的URL字符串
 * @returns 验证结果对象
 */
export const validateUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url) return { valid: true } // 空URL视为有效（可选字段）

  if (typeof url !== 'string') {
    return { valid: false, error: 'URL必须是字符串类型' }
  }

  // 检查是否以http://或https://开头
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, error: 'URL必须以http://或https://开头' }
  }

  // 检查是否包含://结构
  if (!url.includes('://')) {
    return { valid: false, error: 'URL格式不正确，缺少://结构' }
  }

  try {
    // 使用URL构造函数验证基本格式
    new URL(url)
    return { valid: true }
  } catch {
    return { valid: false, error: 'URL格式不正确' }
  }
}

/**
 * 批量验证URL
 * @param urls - URL对象数组，包含url和type字段
 * @returns Promise<ValidationResult[]> - 验证结果数组
 */
export interface UrlValidationItem {
  url: string
  type?: 'image' | 'audio' // 保持兼容性，但不再使用
  name?: string // 用于标识URL的名称
}

export interface ValidationResult {
  url: string
  type?: 'image' | 'audio'
  name?: string
  valid: boolean
  error?: string
}

const normalizeBilibiliWebUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (hostname !== 'bilibili.com' && !hostname.endsWith('.bilibili.com')) return null

    return url.href
  } catch {
    return null
  }
}

export const validateUrls = async (urls: UrlValidationItem[]): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = []

  for (const item of urls) {
    const result = validateUrl(item.url)

    results.push({
      url: item.url,
      type: item.type,
      name: item.name,
      valid: result.valid,
      error: result.error
    })
  }

  return results
}

/**
 * 获取 Bilibili 视频链接
 * @param song - 歌曲对象，包含 playUrl 和 musicId
 * @returns Bilibili 视频链接
 */
export const getBilibiliUrl = (song: {
  playUrl?: string | null
  musicId?: string | null
}): string => {
  if (!song) return '#'

  // 优先使用 playUrl，但必须确认它确实属于 Bilibili 域名
  if (song.playUrl) {
    const bilibiliUrl = normalizeBilibiliWebUrl(song.playUrl)
    if (bilibiliUrl) return bilibiliUrl
  }

  if (song.musicId) {
    // 处理带分P的情况，支持以下格式：
    // 1. BVxxx (只有 BV 号) -> 跳转到 BV 视频页
    // 2. BVxxx:cid (BV + CID) -> 跳转到 BV 视频页 (默认 P1)
    // 3. BVxxx:cid:p (BV + CID + 分P页码) -> 跳转到指定 P

    const parts = song.musicId.split(':')
    const bvId = parts[0]

    // 检查是否有第三个参数（分P信息）
    // 如果没有冒号 (length=1) 或只有一段冒号 (length=2)，则 p=1
    const parsedP = parts.length >= 3 ? parseInt(parts[2]) : 1
    const p = isNaN(parsedP) ? 1 : parsedP

    let url = `https://www.bilibili.com/video/${bvId}/`

    // 只有当 p > 1 时才添加 p 参数
    if (p > 1) {
      url += `?p=${p}`
    }

    return url
  }

  return '#'
}

/**
 * 判断 URL 是否属于 VoiceHub 内部 API
 * @param input 请求的 URL 或 Request 对象
 * @returns boolean
 */
export const isVoiceHubApi = (input: RequestInfo | URL): boolean => {
  try {
    let urlStr = ''
    if (typeof input === 'string') {
      urlStr = input
    } else if (input instanceof URL) {
      urlStr = input.href
    } else if (input instanceof Request) {
      urlStr = input.url
    }

    // 相对路径直接判断
    if (urlStr.startsWith('/api')) return true

    // 如果在客户端环境中，可以检查是否属于当前域名
    if (typeof window !== 'undefined') {
      const urlObj = new URL(urlStr, window.location.origin)
      return urlObj.origin === window.location.origin && urlObj.pathname.startsWith('/api')
    }

    return false
  } catch {
    return false
  }
}

/**
 * 从 localStorage 中获取网易云音乐 Cookie
 * @returns {string | undefined} 返回 Cookie 字符串或 undefined
 */
export const getNeteaseCookie = (): string | undefined => {
  if (import.meta.client) {
    return localStorage.getItem('netease_cookie') || undefined
  }
  return undefined
}
