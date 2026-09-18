/**
 * 播放端确认过的无效播放地址（403、格式不支持等）。
 * 解析链路据此跳过，避免换源重试时反复拿到同一条坏链。
 */
const invalidPlaybackUrls = new Map<string, true>()
// 每次解析都可能产生新地址，需要上限避免长时间播放无界增长
const INVALID_PLAYBACK_URL_LIMIT = 200

const normalizeUrl = (url: string) => url.trim().replace(/^http:\/\//, 'https://')

export const markPlaybackUrlInvalid = (url?: string | null) => {
  if (!url) return
  const key = normalizeUrl(url)
  invalidPlaybackUrls.delete(key)
  invalidPlaybackUrls.set(key, true)
  while (invalidPlaybackUrls.size > INVALID_PLAYBACK_URL_LIMIT) {
    invalidPlaybackUrls.delete(invalidPlaybackUrls.keys().next().value!)
  }
}

export const isPlaybackUrlInvalid = (url?: string | null): boolean =>
  url ? invalidPlaybackUrls.has(normalizeUrl(url)) : false
