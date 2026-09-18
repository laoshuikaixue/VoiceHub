import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { pluginCapabilities } from '~~/server/utils/music-source-plugins/resolver'

export default defineEventHandler(async (event) => {
  await pluginAccess(event)
  return { success: true, data: (await pluginCapabilities()).filter((p) => p.search) }
})
