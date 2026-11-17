import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { orderPlugins } from '~~/server/utils/music-source-plugins/store'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  await orderPlugins(body.ids, Number(body.revision))
  await recordAdminAudit(event, 'plugin.reorder', {
    targetType: 'plugin',
    targetId: `batch:${Array.isArray(body.ids) ? body.ids.length : 0}`,
    summary: { revision: Number(body.revision) }
  })
  return { success: true }
})
