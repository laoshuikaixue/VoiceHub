import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { setPluginEnabled } from '~~/server/utils/music-source-plugins/store'
import { pluginError } from '~~/server/utils/music-source-plugins/errors'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  if (typeof body.enabled !== 'boolean') throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  const id = getRouterParam(event, 'id')!
  await setPluginEnabled(id, body.enabled, Number(body.revision))
  await recordAdminAudit(event, 'plugin.enabled', {
    targetType: 'plugin',
    targetId: id,
    summary: { enabled: body.enabled, revision: Number(body.revision) }
  })
  return { success: true }
})
