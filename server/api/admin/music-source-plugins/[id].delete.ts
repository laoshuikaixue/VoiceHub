import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { removePlugin } from '~~/server/utils/music-source-plugins/store'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  const id = getRouterParam(event, 'id')!
  await removePlugin(id, Number(body.revision))
  await recordAdminAudit(event, 'plugin.delete', {
    targetType: 'plugin',
    targetId: id,
    summary: { revision: Number(body.revision) }
  })
  return { success: true }
})
