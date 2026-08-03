import { startOperationRequest, finishOperationRequest, setOperationRequestContext, recordBusinessOperation, recordOAuthOperation, setMusicSourceProbeRunner } from '~~/server/utils/operations-metrics'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { db } from '~/drizzle/db'
import { apiLogs } from '~/drizzle/schema'
import { sql } from 'drizzle-orm'
import { getInstanceId } from '~~/server/utils/instance-id'

const getPathname = (url = '') => url.split('?')[0]
const MUSIC_SOURCE_PROBE_HEADER = 'x-voicehub-operations-probe'
const MUSIC_SOURCE_PROBE_INTERVAL_MS = Math.min(60 * 60 * 1000, Math.max(60 * 1000, Number(process.env.VOICEHUB_MUSIC_SOURCE_PROBE_INTERVAL_MS) || 5 * 60 * 1000))
const MUSIC_SOURCE_PROBE_QUERY = process.env.VOICEHUB_MUSIC_SOURCE_PROBE_QUERY?.trim() || '周杰伦'
const musicSourceProbeTargets = [
  { source: 'netease', path: `/api/native-api/search/wy?str=${encodeURIComponent(MUSIC_SOURCE_PROBE_QUERY)}&page=1&limit=1` },
  { source: 'tencent', path: `/api/native-api/search/tx?str=${encodeURIComponent(MUSIC_SOURCE_PROBE_QUERY)}&page=1&limit=1` },
  { source: 'bilibili', path: `/api/bilibili/search?keyword=${encodeURIComponent(MUSIC_SOURCE_PROBE_QUERY)}` },
  { source: 'migu', path: `/api/native-api/search/mg?str=${encodeURIComponent(MUSIC_SOURCE_PROBE_QUERY)}&page=1&limit=1` }
]
let musicSourceProbeInFlight: Promise<void> | null = null
let lastMusicSourceProbeAt = 0

const isMusicSourceProbeRequest = (event: any) => String(event.node.req.headers[MUSIC_SOURCE_PROBE_HEADER] || '') === '1'
const isMonitoringRequest = (url = '') => [
  '/api/admin/operations/',
  '/api/system/status',
  '/api/admin/database/pool-status',
  '/api/admin/database/performance',
  '/api/admin/backup/history'
].some((prefix) => url.startsWith(prefix))

const isServerlessRuntime = () => {
  const preset = process.env.NITRO_PRESET || (process.env.VERCEL ? 'vercel' : process.env.NETLIFY === 'true' ? 'netlify' : 'node-server')
  return ['vercel', 'netlify', 'cloudflare', 'serverless'].some((name) => preset.toLowerCase().includes(name))
}

const persistMinuteBucket = (statusCode: number, durationMs: number) => {
  void getInstanceId().then((instanceId) => db.execute(sql`
    INSERT INTO operations_metric_buckets (
      bucket_start, instance_id, request_count, client_error_count,
      server_error_count, total_duration_ms, max_duration_ms
    ) VALUES (
      date_trunc('minute', now()), ${instanceId}, 1,
      ${statusCode >= 400 && statusCode < 500 ? 1 : 0},
      ${statusCode >= 500 ? 1 : 0}, ${Math.round(durationMs)}, ${Math.round(durationMs)}
    ) ON CONFLICT (bucket_start, instance_id) DO UPDATE SET
      request_count = operations_metric_buckets.request_count + 1,
      client_error_count = operations_metric_buckets.client_error_count + EXCLUDED.client_error_count,
      server_error_count = operations_metric_buckets.server_error_count + EXCLUDED.server_error_count,
      total_duration_ms = operations_metric_buckets.total_duration_ms + EXCLUDED.total_duration_ms,
      max_duration_ms = GREATEST(operations_metric_buckets.max_duration_ms, EXCLUDED.max_duration_ms)
  `)).catch(() => {})
}

export default defineNitroPlugin((nitroApp) => {
  const runMusicSourceProbe = async () => {
    if (process.env.VOICEHUB_MUSIC_SOURCE_PROBE_ENABLED === 'false') return
    if (musicSourceProbeInFlight || Date.now() - lastMusicSourceProbeAt < MUSIC_SOURCE_PROBE_INTERVAL_MS) return musicSourceProbeInFlight || undefined

    lastMusicSourceProbeAt = Date.now()
    musicSourceProbeInFlight = (async () => {
      let recentlyObserved = new Set<string>()
      try {
        const rows = await db.execute(sql`
          SELECT DISTINCT source
          FROM operations_dependency_buckets
          WHERE bucket_start >= now() - (${Math.floor(MUSIC_SOURCE_PROBE_INTERVAL_MS / 1000)} * interval '1 second')
        `)
        recentlyObserved = new Set(rows.map((row: any) => String(row.source)))
      } catch {
        // 数据库迁移尚未执行或数据库暂不可用时，仍继续探测以便产生日志和内存指标。
      }

      for (const target of musicSourceProbeTargets) {
        if (recentlyObserved.has(target.source)) continue
        try {
          await nitroApp.localFetch(target.path, {
            headers: { [MUSIC_SOURCE_PROBE_HEADER]: '1' }
          })
        } catch {
          // 各源接口已写入失败指标；调度器不额外抛错以免影响下一平台探测。
        }
      }
    })().finally(() => {
      musicSourceProbeInFlight = null
    })

    return musicSourceProbeInFlight
  }

  setMusicSourceProbeRunner(runMusicSourceProbe)
  if (!isServerlessRuntime()) {
    void runMusicSourceProbe()
    const timer = setInterval(() => { void runMusicSourceProbe() }, MUSIC_SOURCE_PROBE_INTERVAL_MS)
    timer.unref?.()
  }

  nitroApp.hooks.hook('request', (event) => {
    if (isMonitoringRequest(event.node.req.url) || isMusicSourceProbeRequest(event)) return
    const startedAt = startOperationRequest()
    event.context.operationsMetricsStartedAt = startedAt
    const requestId = String(event.node.req.headers['x-request-id'] || event.node.req.headers['x-correlation-id'] || randomUUID())
    event.node.res.setHeader('x-request-id', requestId)
    event.context.operationsMetricsRequestId = requestId
    setOperationRequestContext(startedAt, {
      route: event.node.req.url?.split('?')[0],
      requestId
    })
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const startedAt = event.context.operationsMetricsStartedAt
    if (typeof startedAt === 'number') {
      finishOperationRequest(startedAt, event.node.res.statusCode || 200)
      const path = getPathname(event.node.req.url)
      const success = (event.node.res.statusCode || 200) < 400
      if (path === '/api/songs/request' || path === '/api/open/songs/request') recordBusinessOperation('song_request', success)
      else if (path === '/api/songs/vote') recordBusinessOperation('vote', success)
      else if (path.startsWith('/api/admin/schedule')) recordBusinessOperation('schedule_save', success)
      if (/^\/api\/auth\/[^/]+\/(index|callback)$/.test(path)) recordOAuthOperation(success)
      const durationMs = performance.now() - startedAt
      persistMinuteBucket(event.node.res.statusCode || 200, durationMs)
      if (event.node.res.statusCode >= 400 || durationMs >= 1000) {
        const requestId = event.context.operationsMetricsRequestId || 'generated'
        void db.insert(apiLogs).values({
          endpoint: path || '/',
          method: event.node.req.method || 'GET',
          ipAddress: event.node.req.socket?.remoteAddress || 'unknown',
          userAgent: String(event.node.req.headers['user-agent'] || '').slice(0, 500),
          statusCode: event.node.res.statusCode || 200,
          responseTimeMs: Math.round(durationMs),
          errorMessage: `${event.node.res.statusCode >= 400 ? 'request_error' : 'slow_request'} requestId=${requestId}`
        }).catch(() => {})
      }
    }
  })
})
