import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { pluginAdminView } from '~~/server/utils/music-source-plugins/store'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  return pluginAdminView()
})
