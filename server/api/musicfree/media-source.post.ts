import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { requestTrack, resolvePlugins } from '~~/server/utils/music-source-plugins/resolver'

export default defineEventHandler(async (event) => {
  const user = await pluginAccess(event)
  const body = await readBody(event)
  const item = body.musicItem || {}
  const track = await requestTrack({ platform: item.musicPlatform || item.platform, musicId: item.musicId || item.id, title: item.title, artist: item.artist, selectionToken: item.selectionToken, songId: body.songId }, user.id)
  return resolvePlugins(track, body.quality || 'standard', body.excludeSources || [], user.id)
})
