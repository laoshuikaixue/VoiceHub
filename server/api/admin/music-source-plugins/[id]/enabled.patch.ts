import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { setPluginEnabled } from '~~/server/utils/music-source-plugins/store'
import { pluginError } from '~~/server/utils/music-source-plugins/errors'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  if (typeof body.enabled !== 'boolean') throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  await setPluginEnabled(getRouterParam(event, 'id')!, body.enabled, Number(body.revision))
  return { success: true }
})
