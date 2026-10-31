import { and, eq, isNull } from 'drizzle-orm'
import { sendRedirect, setHeader } from 'h3'
import { db } from '~/drizzle/db'
import { musicSourcePlugins } from '~/drizzle/schema'
import { unseal } from '~~/server/utils/music-source-plugins/tickets'
import { pluginError } from '~~/server/utils/music-source-plugins/errors'
import { openNetwork, probeFinalUrl } from '~~/server/utils/music-source-plugins/network'
import { enabledCatalog } from '~~/server/utils/music-source-plugins/resolver'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getClientIP } from '~~/server/utils/ip-utils'
import { isServerlessRuntime } from '~~/server/utils/serverless-runtime'
import { MUSIC_PLUGIN_LIMITS as limits } from '~~/server/config/constants'

let streams = 0
// 模块级常量：serverless 下函数实例不能陪跑长流
const IS_SERVERLESS = isServerlessRuntime()

export default defineEventHandler(async (event) => {
  const ticket = unseal<any>(String(getQuery(event).ticket || ''), 'media')
  const allowed = await checkDistributedRateLimit(`plugin-media:${getClientIP(event)}`, 120, 60000)
  if (!allowed.isAllowed || streams >= 10) throw pluginError('PLUGIN_UNAVAILABLE', 429)
  const [plugin] = await db.select().from(musicSourcePlugins).where(and(eq(musicSourcePlugins.id, ticket.pluginId), isNull(musicSourcePlugins.deletedAt)))
  if (!plugin?.enabled || !(await enabledCatalog(ticket.catalog))) throw pluginError('PLUGIN_UNAVAILABLE', 403)
  const controller = new AbortController()
  const range = getRequestHeader(event, 'range')
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  const ticketHeaders = { ...ticket.headers, ...(range ? { range } : {}) }
  // serverless：先探测重定向链终点，终点为 https 直链时 302 让浏览器直连，音频流不经过函数
  if (IS_SERVERLESS) {
    const probed = await probeFinalUrl(ticket.url, { headers: ticketHeaders, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(limits.mediaProbeMs)]) })
    if (probed && probed.url !== ticket.url && probed.url.startsWith('https://')) {
      setHeader(event, 'cache-control', 'private, no-store')
      return sendRedirect(event, probed.url, 302)
    }
  }
  streams++
  let released = false
  const cancel = () => { if (released) return; released = true; streams--; controller.abort() }
  event.node.res.once('close', cancel)
  try {
  const proxyTimeout = IS_SERVERLESS ? limits.mediaProxyServerlessMs : limits.mediaProxyMs
  const response = await openNetwork(ticket.url, { headers: ticketHeaders, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(proxyTimeout)]) })
  if (![200, 206, 416].includes(response.statusCode || 0)) {
    // 记录上游真实状态码与主机，区分机房 IP 被拒 / 直链过期 / 重定向丢头，否则只能看到笼统的 502
    console.warn(`[plugin-media] 回源失败 ${response.statusCode || 0}: ${(() => { try { return new URL(ticket.url).hostname } catch { return 'unknown' } })()}`)
    response.destroy(); throw pluginError('PLUGIN_RESOLVE_FAILED')
  }
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
