/** 插件阶段统一入口，解析失败后由既有内置链路继续回退。 */
import { getPersistedSongId, getPluginQuality } from './pluginPlatform'
export async function resolvePluginUrl(platform: string, musicId: string | number, quality: number | string | undefined, options: any = {}) {
  const raw = options.musicInfo?.rawItem || {}
  const level = getPluginQuality(quality)
  let excluded = [...(options.excludeSources || [])]
  let continuation
  for (let batch = 0; batch < 2; batch++) {
    const result: any = await $fetch('/api/music-source-plugins/resolve', {
      method: 'POST', timeout: 27000,
      body: { platform, musicId: String(musicId), quality: level, excludeSources: excluded,
        continuation,
        selectionToken: raw.selectionToken || options.selectionToken,
        preferProxy: options.preferProxy === true,
        songId: options.songId || getPersistedSongId(raw),
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
