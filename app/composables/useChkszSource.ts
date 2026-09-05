import { watch } from 'vue'

// ChKSz 音源（api.chksz.com）：用户自配 apikey，前端直连（接口返回 Access-Control-Allow-Origin: *）
// 仅支持 netease / tencent 平台，接口免费配额有限（约 400 次 + 每分钟 20 次），需缓存与限流
const CHKSZ_BASE_URL = 'https://api.chksz.com'
const STORAGE_KEY = 'chksz_api_key'

// 播放链接缓存（5 分钟，chksz 返回的直链有时效）
const CHKSZ_CACHE_TTL = 5 * 60 * 1000
// 滑动窗口限流：60 秒内最多 18 次，留余量规避接口 20 次/分钟限制
const CHKSZ_RATE_LIMIT_MAX = 18
const CHKSZ_RATE_LIMIT_WINDOW = 60 * 1000

// 项目音质值 → chksz 接口参数
// 网易 level：standard/exhigh/lossless/hires/jymaster
const NETEASE_LEVEL_MAP: Record<number, string> = {
  2: 'standard',
  4: 'exhigh',
  5: 'lossless',
  6: 'hires',
  9: 'jymaster'
}
// QQ size：128k/320k/flac/hires/master
const TENCENT_SIZE_MAP: Record<number, string> = {
  4: '128k',
  8: '320k',
  10: 'flac',
  11: 'hires',
  14: 'master'
}

const chkszUrlCache = new Map<string, { url: string; expireAt: number }>()
// 同 key 请求合并，避免并发重复请求
const chkszInflight = new Map<string, Promise<string | null>>()
// 最近请求时间戳（滑动窗口限流）
const chkszRequestTimes: number[] = []

const readStoredKey = (): string => {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

let globalChkszState: any = null

export function useChkszSource() {
  if (!globalChkszState) {
    globalChkszState = useState<string>('chksz-api-key', () => readStoredKey())

    if (import.meta.client) {
      watch(
        globalChkszState,
        (newValue) => {
          try {
            if (newValue && newValue.trim()) {
              localStorage.setItem(STORAGE_KEY, newValue.trim())
            } else {
              localStorage.removeItem(STORAGE_KEY)
            }
          } catch (error) {
            console.error('[chksz] Failed to save apikey:', error)
          }
        },
        { deep: true }
      )
    }
  }

  const chkszApiKey = globalChkszState

  const hasChkszKey = () => {
    const key = chkszApiKey.value
    return !!(key && key.trim())
  }

  const clearChkszKey = () => {
    chkszApiKey.value = ''
  }

  const checkRateLimit = (): boolean => {
    const now = Date.now()
    const windowStart = now - CHKSZ_RATE_LIMIT_WINDOW
    while (chkszRequestTimes.length > 0 && chkszRequestTimes[0] < windowStart) {
      chkszRequestTimes.shift()
    }
    if (chkszRequestTimes.length >= CHKSZ_RATE_LIMIT_MAX) {
      return false
    }
    chkszRequestTimes.push(now)
    return true
  }

  /**
   * 通过 ChKSz 获取播放链接
   * @returns 播放 URL；未配 key / 不支持的平台音质 / 接口失败均返回 null（走降级链）
   */
  const getChkszMusicUrl = async (
    platform: string,
    musicId: string | number,
    quality: number | string
  ): Promise<string | null> => {
    if (!hasChkszKey()) return null

    const apiKey = chkszApiKey.value.trim()
    const normalizedQuality = Number(quality)
    let endpoint = ''
    let qualityParam = ''

    if (platform === 'netease') {
      const level = NETEASE_LEVEL_MAP[normalizedQuality]
      if (!level) return null
      endpoint = '163_music'
      qualityParam = `level=${level}`
    } else if (platform === 'tencent') {
      const size = TENCENT_SIZE_MAP[normalizedQuality]
      if (!size) return null
      endpoint = 'qq_music'
      qualityParam = `size=${size}&type=json`
    } else {
      return null
    }

    const cacheKey = `${platform}:${musicId}:${qualityParam}`
    const cached = chkszUrlCache.get(cacheKey)
    if (cached && cached.expireAt > Date.now()) {
      return cached.url
    }

    const now = Date.now()
    for (const [key, entry] of chkszUrlCache) {
      if (entry.expireAt <= now) {
        chkszUrlCache.delete(key)
      }
    }

    const inflight = chkszInflight.get(cacheKey)
    if (inflight) {
      return inflight
    }

    if (!checkRateLimit()) {
      console.warn('[chksz] 请求过于频繁，跳过本次请求')
      return null
    }

    const promise = (async (): Promise<string | null> => {
      try {
        const apiUrl =
          `${CHKSZ_BASE_URL}/api/${endpoint}?` +
          `${platform === 'netease' ? 'id' : 'mid'}=${encodeURIComponent(String(musicId))}&` +
          `${qualityParam}&apikey=${encodeURIComponent(apiKey)}`
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) return null
        const data: any = await response.json()
        const url = platform === 'netease' ? data?.data?.url : data?.url
        if (data?.code === 200 && url && /^https?:\/\//i.test(String(url))) {
          const finalUrl = String(url)
          chkszUrlCache.set(cacheKey, { url: finalUrl, expireAt: Date.now() + CHKSZ_CACHE_TTL })
          return finalUrl
        }
      } catch (error) {
        console.warn('[chksz] 获取播放链接失败:', error)
      }
      return null
    })()

    chkszInflight.set(cacheKey, promise)
    promise.finally(() => {
      chkszInflight.delete(cacheKey)
    })
    return promise
  }

  /**
   * 验证 apikey 有效性（消耗 1 次接口配额）
   */
  const verifyChkszKey = async (
    key?: string
  ): Promise<{ valid: boolean; message: string; detail?: string; quotaRemaining?: number }> => {
    const apiKey = (key !== undefined ? key : chkszApiKey.value).trim()
    if (!apiKey) {
      return { valid: false, message: 'empty' }
    }
    try {
      const response = await fetch(
        `${CHKSZ_BASE_URL}/api/163_music?id=347230&level=standard&apikey=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!response.ok) {
        return { valid: false, message: `http_${response.status}` }
      }
      const data: any = await response.json()
      if (data?.code === 200 && data?.data?.url) {
        return { valid: true, message: 'ok' }
      }
      // key 无效（401/403 语义）或配额耗尽时接口返回业务错误码
      return { valid: false, message: 'api_error', detail: data?.msg }
    } catch (error: any) {
      return { valid: false, message: error?.name === 'TimeoutError' ? 'timeout' : 'network' }
    }
  }

  return {
    chkszApiKey,
    hasChkszKey,
    clearChkszKey,
    getChkszMusicUrl,
    verifyChkszKey
  }
}
