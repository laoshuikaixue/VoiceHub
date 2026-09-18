import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { refreshPlugin, snapshotMode } from '~~/server/utils/music-source-plugins/store'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  if (snapshotMode()) return { pendingDeploy: true }
  await refreshPlugin(getRouterParam(event, 'id')!)
  return { success: true }
})
