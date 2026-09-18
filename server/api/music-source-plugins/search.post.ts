import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { searchPlugins } from '~~/server/utils/music-source-plugins/resolver'
import { pluginIdFromPlatform } from '~~/server/utils/music-source-plugins/platform'

export default defineEventHandler(async (event) => {
  const user = await pluginAccess(event)
  const body = await readBody(event)
  const requested = String(body.pluginId || '')
  return { success: true, ...await searchPlugins(String(body.query || ''), Number(body.page), pluginIdFromPlatform(requested) ?? requested, user.id) }
})
