import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { pluginCapabilities } from '~~/server/utils/music-source-plugins/resolver'

export default defineEventHandler(async (event) => {
  await pluginAccess(event)
  return { data: await pluginCapabilities() }
})
