import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { requestTrack, resolvePlugins } from '~~/server/utils/music-source-plugins/resolver'
import { unseal } from '~~/server/utils/music-source-plugins/tickets'
import { pluginError } from '~~/server/utils/music-source-plugins/errors'

export default defineEventHandler(async (event) => {
  const user = await pluginAccess(event)
  const body = await readBody(event)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  event.node.res.on('close', cancel)
  try {
    if (body.continuation) {
      const next = unseal(body.continuation, 'continuation')
      if (next.userId !== user.id) throw pluginError('PLUGIN_INVALID_TICKET', 400)
      return await resolvePlugins(next.track, next.quality, next.attempted, user.id, controller.signal, body.preferProxy === true)
    }
    const track = await requestTrack(body, user)
    return await resolvePlugins(track, ['standard', 'high', 'super', 'lossless'].includes(body.quality) ? body.quality : 'standard', Array.isArray(body.excludeSources) ? body.excludeSources.filter((v: unknown) => typeof v === 'string').slice(0, 40) : [], user.id, controller.signal, body.preferProxy === true)
  } finally { event.node.res.off('close', cancel) }
})
