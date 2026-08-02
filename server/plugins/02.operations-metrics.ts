import { startOperationRequest, finishOperationRequest, setOperationRequestContext, recordBusinessOperation, recordOAuthOperation } from '~~/server/utils/operations-metrics'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { db } from '~/drizzle/db'
import { apiLogs } from '~/drizzle/schema'
import { sql } from 'drizzle-orm'
import { getInstanceId } from '~~/server/utils/instance-id'

const getPathname = (url = '') => url.split('?')[0]

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
  nitroApp.hooks.hook('request', (event) => {
    if (event.node.req.url?.startsWith('/api/admin/operations/metrics')) return
    const startedAt = startOperationRequest()
    event.context.operationsMetricsStartedAt = startedAt
    const requestId = String(event.node.req.headers['x-request-id'] || event.node.req.headers['x-correlation-id'] || randomUUID())
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
  })
})
