import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { refreshPlugin, snapshotMode } from '~~/server/utils/music-source-plugins/store'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  if (snapshotMode()) return { pendingDeploy: true }
  const id = getRouterParam(event, 'id')!
  const artifact = await refreshPlugin(id)
  await recordAdminAudit(event, 'plugin.refresh', {
    targetType: 'plugin',
    targetId: id,
    summary: { revision: artifact?.revision, protocol: artifact?.protocol }
  })
  return { success: true }
})
