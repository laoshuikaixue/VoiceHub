import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { requestTrack, pluginLyric } from '~~/server/utils/music-source-plugins/resolver'

export default defineEventHandler(async (event) => {
  const user = await pluginAccess(event)
  const body = await readBody(event)
  const item = body.musicItem || {}
  return { success: true, data: await pluginLyric(await requestTrack({ platform: item.musicPlatform, musicId: item.musicId || item.id, selectionToken: item.selectionToken, songId: body.songId }, user.id)) }
})
