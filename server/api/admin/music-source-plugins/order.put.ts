import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { orderPlugins } from '~~/server/utils/music-source-plugins/store'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  await orderPlugins(body.ids, Number(body.revision))
  return { success: true }
})
