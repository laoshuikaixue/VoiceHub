import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { musicSourcePlugins } from '~/drizzle/schema'
import { unseal } from '~~/server/utils/music-source-plugins/tickets'
import { pluginError } from '~~/server/utils/music-source-plugins/errors'
import { openNetwork } from '~~/server/utils/music-source-plugins/network'
import { enabledCatalog } from '~~/server/utils/music-source-plugins/resolver'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getClientIP } from '~~/server/utils/ip-utils'

let streams = 0

export default defineEventHandler(async (event) => {
  const ticket = unseal<any>(String(getQuery(event).ticket || ''), 'media')
  const allowed = await checkDistributedRateLimit(`plugin-media:${getClientIP(event)}`, 120, 60000)
  if (!allowed.isAllowed || streams >= 10) throw pluginError('PLUGIN_UNAVAILABLE', 429)
  const [plugin] = await db.select().from(musicSourcePlugins).where(and(eq(musicSourcePlugins.id, ticket.pluginId), isNull(musicSourcePlugins.deletedAt)))
  if (!plugin?.enabled || !(await enabledCatalog(ticket.catalog))) throw pluginError('PLUGIN_UNAVAILABLE', 403)
  const controller = new AbortController()
  const range = getRequestHeader(event, 'range')
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  streams++
  let released = false
  const cancel = () => { if (released) return; released = true; streams--; controller.abort() }
  event.node.res.once('close', cancel)
  try {
  const response = await openNetwork(ticket.url, { headers: { ...ticket.headers, ...(range ? { range } : {}) }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30 * 60 * 1000)]) })
  if (![200, 206, 416].includes(response.statusCode || 0)) { response.destroy(); throw pluginError('PLUGIN_RESOLVE_FAILED') }
  setResponseStatus(event, response.statusCode!)
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = response.headers[name]
    if (value) setHeader(event, name, value)
  }
  setHeader(event, 'cache-control', 'private, no-store')
  setHeader(event, 'referrer-policy', 'no-referrer')
  return await sendStream(event, response)
  } finally { event.node.res.off('close', cancel); cancel() }
})
