import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { searchPlugins } from '~~/server/utils/music-source-plugins/resolver'

export default defineEventHandler(async (event) => {
  const user = await pluginAccess(event)
  const body = await readBody(event)
  return { success: true, ...await searchPlugins(String(body.query || ''), Number(body.page), String(body.pluginId || '').replace(/^musicfree:/, ''), user.id) }
})
