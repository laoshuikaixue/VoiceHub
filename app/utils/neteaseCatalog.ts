const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** 仅采用歌曲、音质及完整播放标记均匹配的网易云曲库响应。 */
export function getNeteaseCatalogUrl(response: unknown, level: string, id: string | number): string | null {
  if (!isRecord(response) || response.code !== 200 || !Array.isArray(response.data)) return null
  const firstId = String(id).split(',')[0].trim()
  const track = response.data.find(item => isRecord(item) && String(item.id) === firstId)
  if (!isRecord(track) || track.level !== level || track.freeTrialInfo != null ||
      typeof track.url !== 'string' || !track.url.trim()) return null
  try {
    const url = new URL(track.url)
    return url.protocol === 'https:' || url.protocol === 'http:' ? track.url.trim() : null
  } catch {
    return null
  }
}
