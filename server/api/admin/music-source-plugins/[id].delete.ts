import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { removePlugin } from '~~/server/utils/music-source-plugins/store'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  await removePlugin(getRouterParam(event, 'id')!, Number(body.revision))
  return { success: true }
})
