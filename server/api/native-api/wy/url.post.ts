import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { enforceAnonymousMusicResolveRateLimit } from '~~/server/utils/music-resolve-rate-limit'
import { networkUrl, requestNetwork } from '~~/server/utils/music-source-plugins/network'

// ikun 网易云备用源服务端代理
const IKUN_WY_URL = 'https://c.wwwweb.top/music/url'

// 网易云 level → 上游音质字符串；higher(192k) 上游无对应档，就近取 320k
const LEVEL_TO_QUALITY: Record<string, string> = {
  standard: '128k',
  higher: '320k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  jymaster: 'master'
}

export default defineEventHandler(async (event) => {
  await enforceAnonymousMusicResolveRateLimit(event)
  const body = await readBody(event)
  const rawId = body?.musicId
  const musicId = typeof rawId === 'string' || (typeof rawId === 'number' && Number.isSafeInteger(rawId))
    ? String(rawId).trim()
    : ''
  if (!/^[1-9]\d{0,19}$/.test(musicId)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '歌曲 ID 无效')
  }

  const level = typeof body?.level === 'string' ? body.level : 'exhigh'
  const quality = Object.hasOwn(LEVEL_TO_QUALITY, level) ? LEVEL_TO_QUALITY[level] : '320k'
  const signal = AbortSignal.timeout(9000)
  try {
    const response = await requestNetwork(IKUN_WY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'lx-music-desktop/2.10.1'
      },
      body: JSON.stringify({ source: 'wy', musicId, quality }),
      signal
    }, 64 * 1024)
    const data = JSON.parse(response.bytes.toString('utf8'))
    if (response.status >= 200 && response.status < 300 && data?.code === 200 && typeof data.url === 'string') {
      return { success: true, url: networkUrl(data.url).href, quality: typeof data.quality === 'string' ? data.quality : quality }
    }
  } catch {
    // 上游错误统一转换，避免向客户端透传第三方响应。
  }
  throw createApiError(signal.aborted ? 504 : 502, SERVER_ERROR_CODES.MUSIC_URL_RESOLVE_FAILED, '播放链接解析失败，请稍后重试')
})
