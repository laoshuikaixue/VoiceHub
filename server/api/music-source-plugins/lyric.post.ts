import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { requestTrack, pluginLyric } from '~~/server/utils/music-source-plugins/resolver'

export default defineEventHandler(async (event) => {
  const user = await pluginAccess(event)
  return { success: true, data: await pluginLyric(await requestTrack(await readBody(event), user)) }
})
