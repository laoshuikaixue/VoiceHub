import { createError, defineEventHandler, getHeader, setHeader } from 'h3'
import { getOperationsMetrics } from '~~/server/utils/operations-metrics'
import { getRedisStats } from '~~/server/utils/redis'

const metric = (name: string, value: unknown, labels?: Record<string, string>) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  const renderedLabels = labels
    ? `{${Object.entries(labels).map(([key, label]) => `${key}="${String(label).replaceAll('"', '\\"')}"`).join(',')}}`
    : ''
  return `${name}${renderedLabels} ${numeric}\n`
}

export default defineEventHandler((event) => {
  const token = process.env.VOICEHUB_METRICS_TOKEN
  if (!token || getHeader(event, 'authorization') !== `Bearer ${token}`) {
    throw createError({ statusCode: 404, message: 'Not Found' })
  }

  const snapshot = getOperationsMetrics()
  const redis = getRedisStats()
  const lines = [
    '# HELP voicehub_http_requests_window Requests observed in the five-minute in-process window.',
    '# TYPE voicehub_http_requests_window gauge',
    metric('voicehub_http_requests_window', snapshot.http.recentRequests),
    metric('voicehub_http_requests_per_second', snapshot.http.requestsPerSecond),
    metric('voicehub_http_errors_window', snapshot.http.recent4xx, { class: '4xx' }),
    metric('voicehub_http_errors_window', snapshot.http.recent5xx, { class: '5xx' }),
    metric('voicehub_http_latency_ms', snapshot.http.p50Ms, { quantile: '0.5' }),
    metric('voicehub_http_latency_ms', snapshot.http.p95Ms, { quantile: '0.95' }),
    metric('voicehub_http_latency_ms', snapshot.http.p99Ms, { quantile: '0.99' }),
    metric('voicehub_event_loop_lag_ms', snapshot.eventLoop.p99Ms, { quantile: '0.99' }),
    metric('voicehub_process_memory_bytes', snapshot.process.memory.rss, { type: 'rss' }),
    metric('voicehub_redis_configured', redis.configured ? 1 : 0),
    metric('voicehub_redis_connected', redis.connected ? 1 : 0)
  ]

  for (const [source, item] of Object.entries(snapshot.dependencies)) {
    const dependency = item as { calls: number; successRate: number | null; emptyResultRate: number | null; semanticFailureRate: number | null }
    lines.push(metric('voicehub_dependency_calls_total', dependency.calls, { source }))
    lines.push(metric('voicehub_dependency_success_rate', dependency.successRate, { source }))
    lines.push(metric('voicehub_dependency_empty_result_rate', dependency.emptyResultRate, { source }))
    lines.push(metric('voicehub_dependency_semantic_failure_rate', dependency.semanticFailureRate, { source }))
  }

  setHeader(event, 'Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  return lines.filter(Boolean).join('')
})
