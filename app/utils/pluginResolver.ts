/** 插件阶段统一入口，解析失败后由既有内置链路继续回退。 */
export async function resolvePluginUrl(platform: string, musicId: string | number, quality: number | string | undefined, options: any = {}) {
  const raw = options.musicInfo?.rawItem || {}
  const level = typeof quality === 'string' && ['standard', 'high', 'super', 'lossless'].includes(quality)
    ? quality
    : Number(quality) >= 10 ? 'lossless' : Number(quality) >= 5 ? 'super' : Number(quality) >= 4 ? 'high' : 'standard'
  let excluded = [...(options.excludeSources || [])]
  let continuation
  for (let batch = 0; batch < 2; batch++) {
    const result: any = await $fetch('/api/music-source-plugins/resolve', {
      method: 'POST', timeout: 27000,
      body: { platform, musicId: String(musicId), quality: level, excludeSources: excluded,
        continuation,
        selectionToken: raw.selectionToken || options.selectionToken,
        songId: options.songId || (!raw.selectionToken && Number.isInteger(raw.id) && (raw.requesterId !== undefined || raw.createdAt) ? raw.id : undefined),
        title: options.musicInfo?.name || raw.title,
        artist: options.musicInfo?.artist || raw.artist,
        album: options.musicInfo?.album || raw.album,
        duration: raw.durationSeconds || raw.duration }
    })
    if (result.success && result.url) return result
    if (!result.more) return null
    excluded = result.attempted
    continuation = result.continuation
  }
  return null
}
