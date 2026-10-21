const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** 排除试听响应；返回音质与请求不同不代表音频无法完整播放。 */
export function getNeteaseCatalogResult(response: unknown, id: string | number): { url: string; actualQuality: string | null } | null {
  if (!isRecord(response) || response.code !== 200 || !Array.isArray(response.data)) return null
  const firstId = String(id).split(',')[0].trim()
  const items = response.data.filter(isRecord)
  // 解锁链路对批量 ID 只返回首曲且 id 可能为 null，单项响应缺省 id 时不存在错配
  const track = items.find(item => String(item.id) === firstId) ||
    (items.length === 1 ? items.find(item => item.id == null) : undefined) ||
    null
  if (!track) return null
  const trial = track.freeTrialInfo
  if (trial && trial !== 'null') return null
  if (typeof track.url !== 'string' || !track.url.trim()) return null
  try {
    const url = new URL(track.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    // SDK 解锁结果的 level 为请求值回填，不能视为实际音质。
    const actualQuality = trial === 'null' || typeof track.level !== 'string' || !track.level ? null : track.level
    return { url: track.url.trim(), actualQuality }
  } catch {
    return null
  }
}
