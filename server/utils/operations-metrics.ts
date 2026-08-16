import { PerformanceObserver, monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { cpus, freemem, hostname, loadavg, totalmem } from 'node:os'
import { readFileSync, statfsSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { getInstanceId } from '~~/server/utils/instance-id'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'

const WINDOW_MS = 5 * 60 * 1000
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 })
eventLoopHistogram.enable()
let cpuUsageSnapshot = {
  usage: process.cpuUsage(),
  collectedAt: performance.now()
}
const readSystemCpuTimes = () => cpus().reduce((result, cpu) => {
  const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
  result.idle += cpu.times.idle
  result.total += total
  return result
}, { idle: 0, total: 0 })
let systemCpuSnapshot = readSystemCpuTimes()

const state = {
  startedAt: getServerTimestamp(),
  observedDeploymentTarget: null as 'edgeone' | null,
  totalRequests: 0,
  clientErrors: 0,
  serverErrors: 0,
  activeRequests: 0,
  samples: [] as Array<{ at: number; status: number; durationMs: number; route?: string; requestId?: string }>,
  requestContext: new Map<number, { route?: string; requestId?: string }>(),
  businessSamples: [] as Array<{ at: number; operation: string; success: boolean }>,
  oauthSamples: [] as Array<{ at: number; success: boolean }>,
  dependencies: new Map<string, {
    calls: number
    successes: number
    emptyResults: number
    semanticFailures: number
    timeouts: number
    retries: number
    fallbacks: number
    durationMs: number
    durations: number[]
    lastError: string | null
  }>(),
  turnstile: { calls: 0, successes: 0, upstreamFailures: 0, validationFailures: 0 },
  notifications: { smtpAccepted: 0, smtpFailures: 0, meowEligible: 0, meowSkipped: 0, meowTransportFailures: 0 },
  backups: new Map<string, { successes: number; failures: number; durationMs: number }>(),
  backupSnapshot: null as null | { exportedTables: number; skippedTables: number; checksum: string; collectedAt: string },
  cache: { hits: 0, misses: 0, evictions: 0 },
  gc: { count: 0, durationMs: 0 },
  ssrPrewarm: { attempts: 0, successes: 0, failures: 0, lastDurationMs: null as number | null, lastResult: null as string | null }
}

let musicSourceProbeRunner: ((force?: boolean) => Promise<void>) | null = null

export const setMusicSourceProbeRunner = (runner: ((force?: boolean) => Promise<void>) | null) => {
  musicSourceProbeRunner = runner
}

export const triggerMusicSourceProbe = (force = false) => musicSourceProbeRunner?.(force)

const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    state.gc.count += 1
    state.gc.durationMs += entry.duration
  }
})
gcObserver.observe({ entryTypes: ['gc'] })

const prune = () => {
  const cutoff = getServerTimestamp() - WINDOW_MS
  state.samples = state.samples.filter((sample) => sample.at >= cutoff)
  state.businessSamples = state.businessSamples.filter((sample) => sample.at >= cutoff)
  state.oauthSamples = state.oauthSamples.filter((sample) => sample.at >= cutoff)
}

export const startOperationRequest = () => {
  state.activeRequests += 1
  return performance.now()
}

export const setOperationRequestContext = (startedAt: number, context: { route?: string; requestId?: string }) => {
  state.requestContext.set(startedAt, context)
}

export const finishOperationRequest = (startedAt: number, statusCode: number) => {
  const durationMs = Math.max(0, performance.now() - startedAt)
  state.activeRequests = Math.max(0, state.activeRequests - 1)
  state.totalRequests += 1
  if (statusCode >= 400 && statusCode < 500) state.clientErrors += 1
  if (statusCode >= 500) state.serverErrors += 1
  const context = state.requestContext.get(startedAt)
  state.requestContext.delete(startedAt)
  state.samples.push({ at: getServerTimestamp(), status: statusCode, durationMs, ...context })
  if (state.samples.length > 5000) state.samples = state.samples.slice(-5000)
  prune()
}

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
}

const hasPlatformEnv = (value: string | undefined) => Boolean(value && value !== '0' && value.toLowerCase() !== 'false')

const getConfiguredDeploymentTarget = () => {
  const target = String(process.env.VOICEHUB_DEPLOYMENT_TARGET || '').trim().toLowerCase()
  return ['vercel', 'netlify', 'edgeone', 'cloudflare'].includes(target) ? target : null
}

export const observeRuntimeDeployment = (headers: Record<string, string | string[] | undefined> = {}) => {
  const hasEdgeOneHeader = Object.entries(headers).some(([name, value]) => {
    const normalizedName = name.toLowerCase()
    return Boolean(value) && (normalizedName.startsWith('eo-') || normalizedName.startsWith('x-edgeone-'))
  })
  if (hasEdgeOneHeader) state.observedDeploymentTarget = 'edgeone'
}

const getRuntimeDescriptor = () => {
  // 平台环境变量优先于 Nitro preset，避免 Vercel 构建产物使用 node-server 时被误判为自托管。
  const deploymentTarget = getConfiguredDeploymentTarget()
    || (hasPlatformEnv(process.env.VERCEL) || hasPlatformEnv(process.env.VERCEL_ENV)
      ? 'vercel'
      : hasPlatformEnv(process.env.NETLIFY)
        ? 'netlify'
        : hasPlatformEnv(process.env.EDGEONE) || hasPlatformEnv(process.env.EDGEONE_PAGES) || hasPlatformEnv(process.env.EDGEONE_ENV)
          ? 'edgeone'
          : hasPlatformEnv(process.env.CF_PAGES) || hasPlatformEnv(process.env.CLOUDFLARE)
            ? 'cloudflare'
            : state.observedDeploymentTarget)
  const nitroPreset = process.env.NITRO_PRESET || deploymentTarget || 'node-server'
  const serverless = Boolean(deploymentTarget) || ['vercel', 'netlify', 'edgeone', 'cloudflare', 'serverless'].some((name) => nitroPreset.toLowerCase().includes(name))
  return {
    nitroPreset,
    deploymentTarget,
    serverless,
    hostname: process.env.HOSTNAME || hostname(),
    processId: process.pid,
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || process.env.NETLIFY_COMMIT_REF || null,
    appVersion: process.env.APP_VERSION || process.env.npm_package_version || null,
    startedAt: new Date(state.startedAt).toISOString()
  }
}

const getProcessCpuUsage = () => {
  const collectedAt = performance.now()
  const elapsedMs = collectedAt - cpuUsageSnapshot.collectedAt
  const usage = process.cpuUsage(cpuUsageSnapshot.usage)
  cpuUsageSnapshot = { usage: process.cpuUsage(), collectedAt }

  if (elapsedMs <= 0) return null
  const cpuMs = (usage.user + usage.system) / 1000
  return Number((cpuMs / elapsedMs * 100).toFixed(2))
}

const getSystemCpuUsage = () => {
  const current = readSystemCpuTimes()
  const idleDelta = current.idle - systemCpuSnapshot.idle
  const totalDelta = current.total - systemCpuSnapshot.total
  systemCpuSnapshot = current
  if (totalDelta <= 0) return null
  return Number((Math.max(0, Math.min(1, 1 - idleDelta / totalDelta)) * 100).toFixed(2))
}

const getNetworkBytes = () => {
  if (process.platform !== 'linux') return { rxBytes: null, txBytes: null }
  try {
    const rows = readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)
    return rows.reduce((result, row) => {
      const [interfaceName, payload] = row.split(':')
      if (!payload) return result
      if (interfaceName.trim() === 'lo') return result
      const values = payload.trim().split(/\s+/).map(Number)
      if (values.length < 9) return result
      const rxBytes = values[0] ?? 0
      const txBytes = values[8] ?? 0
      result.rxBytes += Number.isFinite(rxBytes) ? rxBytes : 0
      result.txBytes += Number.isFinite(txBytes) ? txBytes : 0
      return result
    }, { rxBytes: 0, txBytes: 0 })
  } catch {
    return { rxBytes: null, txBytes: null }
  }
}

const getDiskBytes = () => {
  try {
    const stats = statfsSync(process.cwd())
    const totalBytes = Number(stats.blocks) * Number(stats.bsize)
    const freeBytes = Number(stats.bavail) * Number(stats.bsize)
    if (!Number.isFinite(totalBytes) || !Number.isFinite(freeBytes)) return { usedBytes: null, totalBytes: null }
    return { usedBytes: Math.max(0, totalBytes - freeBytes), totalBytes }
  } catch {
    return { usedBytes: null, totalBytes: null }
  }
}

const getSystemResourceSnapshot = (cpuUsagePercent: number | null) => {
  const cpuList = cpus()
  const memoryTotalBytes = totalmem()
  const memoryFreeBytes = freemem()
  const disk = getDiskBytes()
  const network = getNetworkBytes()
  return {
    cpuUsagePercent,
    cpuModel: cpuList[0]?.model || null,
    cpuCores: cpuList.length || null,
    loadAverage: loadavg().map((value) => Number(value.toFixed(2))),
    memoryUsedBytes: Number.isFinite(memoryTotalBytes) && Number.isFinite(memoryFreeBytes) ? Math.max(0, memoryTotalBytes - memoryFreeBytes) : null,
    memoryTotalBytes: Number.isFinite(memoryTotalBytes) ? memoryTotalBytes : null,
    diskUsedBytes: disk.usedBytes,
    diskTotalBytes: disk.totalBytes,
    networkRxBytes: network.rxBytes,
    networkTxBytes: network.txBytes
  }
}

export const persistOperationsResourceSnapshot = (snapshot: ReturnType<typeof getSystemResourceSnapshot>) => {
  void getInstanceId().then((instanceId) => db.execute(sql`
    INSERT INTO operations_metric_buckets (
      bucket_start, instance_id, cpu_usage_percent, memory_used_bytes,
      memory_total_bytes, disk_used_bytes, disk_total_bytes,
      network_rx_bytes, network_tx_bytes
    ) VALUES (
      date_trunc('minute', now()), ${instanceId}, ${snapshot.cpuUsagePercent},
      ${snapshot.memoryUsedBytes}, ${snapshot.memoryTotalBytes},
      ${snapshot.diskUsedBytes}, ${snapshot.diskTotalBytes},
      ${snapshot.networkRxBytes}, ${snapshot.networkTxBytes}
    ) ON CONFLICT (bucket_start, instance_id) DO UPDATE SET
      cpu_usage_percent = COALESCE(EXCLUDED.cpu_usage_percent, operations_metric_buckets.cpu_usage_percent),
      memory_used_bytes = COALESCE(EXCLUDED.memory_used_bytes, operations_metric_buckets.memory_used_bytes),
      memory_total_bytes = COALESCE(EXCLUDED.memory_total_bytes, operations_metric_buckets.memory_total_bytes),
      disk_used_bytes = COALESCE(EXCLUDED.disk_used_bytes, operations_metric_buckets.disk_used_bytes),
      disk_total_bytes = COALESCE(EXCLUDED.disk_total_bytes, operations_metric_buckets.disk_total_bytes),
      network_rx_bytes = COALESCE(EXCLUDED.network_rx_bytes, operations_metric_buckets.network_rx_bytes),
      network_tx_bytes = COALESCE(EXCLUDED.network_tx_bytes, operations_metric_buckets.network_tx_bytes)
  `)).catch(() => {})
}

export const persistOperationsDatabaseSnapshot = (snapshot: {
  queriesExecuted?: number | string | null
  activeConnections?: number | string | null
  totalConnections?: number | string | null
  slowQueryCount?: number | string | null
}) => {
  void getInstanceId().then((instanceId) => db.execute(sql`
    INSERT INTO operations_metric_buckets (
      bucket_start, instance_id, database_query_total, database_active_connections,
      database_total_connections, database_slow_query_count
    ) VALUES (
      date_trunc('minute', now()), ${instanceId}, ${snapshot.queriesExecuted ?? null},
      ${snapshot.activeConnections ?? null}, ${snapshot.totalConnections ?? null},
      ${snapshot.slowQueryCount ?? null}
    ) ON CONFLICT (bucket_start, instance_id) DO UPDATE SET
      database_query_total = COALESCE(EXCLUDED.database_query_total, operations_metric_buckets.database_query_total),
      database_active_connections = COALESCE(EXCLUDED.database_active_connections, operations_metric_buckets.database_active_connections),
      database_total_connections = COALESCE(EXCLUDED.database_total_connections, operations_metric_buckets.database_total_connections),
      database_slow_query_count = COALESCE(EXCLUDED.database_slow_query_count, operations_metric_buckets.database_slow_query_count)
  `)).catch(() => {})
}

export const getOperationsMetrics = () => {
  prune()
  const processCpuUsagePercent = getProcessCpuUsage()
  const resources = getSystemResourceSnapshot(getSystemCpuUsage())
  persistOperationsResourceSnapshot(resources)
  const durations = state.samples.map((sample) => sample.durationMs)
  const recentRequests = state.samples.length
  const recent5xx = state.samples.filter((sample) => sample.status >= 500).length
  const recent4xx = state.samples.filter((sample) => sample.status >= 400 && sample.status < 500).length
  const status401 = state.samples.filter((sample) => sample.status === 401).length
  const status403 = state.samples.filter((sample) => sample.status === 403).length
  const status429 = state.samples.filter((sample) => sample.status === 429).length
  const business = Object.fromEntries(['song_request', 'schedule_save', 'vote'].map((operation) => {
    const samples = state.businessSamples.filter((sample) => sample.operation === operation)
    const successes = samples.filter((sample) => sample.success).length
    return [operation, {
      calls: samples.length,
      successRate: samples.length ? Number((successes / samples.length * 100).toFixed(2)) : null,
      requestsPerSecond: Number((samples.length / (WINDOW_MS / 1000)).toFixed(3))
    }]
  }))
  const oauthSuccesses = state.oauthSamples.filter((sample) => sample.success).length
  const bucketSize = WINDOW_MS / 12
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const start = getServerTimestamp() - WINDOW_MS + index * bucketSize
    const bucket = state.samples.filter((sample) => sample.at >= start && sample.at < start + bucketSize)
    const errors = bucket.filter((sample) => sample.status >= 500).length
    return {
      at: new Date(start + bucketSize).toISOString(),
      requests: bucket.length,
      errors,
      p95Ms: percentile(bucket.map((sample) => sample.durationMs), 0.95)
    }
  })
  const histogram = eventLoopHistogram
  const eventLoop = {
    meanMs: histogram.count ? Number((Number(histogram.mean) / 1e6).toFixed(2)) : null,
    maxMs: histogram.count ? Number((Number(histogram.max) / 1e6).toFixed(2)) : null,
    p99Ms: histogram.count ? Number((Number(histogram.percentile(99)) / 1e6).toFixed(2)) : null
  }
  const dependencies = Object.fromEntries([...state.dependencies.entries()].map(([source, item]) => [
    source,
    {
      calls: item.calls,
      successRate: item.calls ? Number((item.successes / item.calls * 100).toFixed(2)) : null,
      emptyResultRate: item.calls ? Number((item.emptyResults / item.calls * 100).toFixed(2)) : null,
      semanticFailureRate: item.calls ? Number((item.semanticFailures / item.calls * 100).toFixed(2)) : null,
      averageDurationMs: item.calls ? Number((item.durationMs / item.calls).toFixed(2)) : null,
      p95DurationMs: percentile(item.durations, 0.95) == null ? null : Number(percentile(item.durations, 0.95)?.toFixed(2)),
      timeouts: item.timeouts,
      retries: item.retries,
      fallbacks: item.fallbacks,
      lastError: item.lastError
    }
  ])) as Record<string, { calls: number; successRate: number | null; p95DurationMs: number | null; lastError: string | null }>
  const alerts: Array<{ code: string; severity: 'warning' | 'critical'; priority: 'P0' | 'P1' | 'P2' | 'P3'; target: 'performance' | 'dependencies' | 'logs'; message: string; value: number; threshold: number }> = []
  const serverErrorRate = recentRequests ? recent5xx / recentRequests * 100 : null
  const healthScore = serverErrorRate == null ? null : Number(Math.max(0, 100 - serverErrorRate).toFixed(1))
  if (serverErrorRate != null && serverErrorRate >= 1) {
    alerts.push({ code: 'http_5xx_rate', severity: serverErrorRate >= 5 ? 'critical' : 'warning', priority: serverErrorRate >= 5 ? 'P0' : 'P1', target: 'performance', message: 'HTTP 5xx 错误率超过阈值', value: Number(serverErrorRate.toFixed(2)), threshold: 1 })
  }
  const p95Ms = percentile(durations, 0.95)
  if (p95Ms != null && p95Ms >= 1500) {
    alerts.push({ code: 'http_p95_latency', severity: 'warning', priority: 'P2', target: 'performance', message: 'HTTP P95 响应延迟超过阈值', value: Number(p95Ms.toFixed(2)), threshold: 1500 })
  }
  if (eventLoop.p99Ms != null && eventLoop.p99Ms >= 50) {
    alerts.push({ code: 'event_loop_p99', severity: eventLoop.p99Ms >= 200 ? 'critical' : 'warning', priority: eventLoop.p99Ms >= 200 ? 'P1' : 'P3', target: 'performance', message: '事件循环 P99 延迟超过阈值', value: eventLoop.p99Ms, threshold: 50 })
  }
  for (const [source, dependency] of Object.entries(dependencies)) {
    if (!dependency.calls || dependency.successRate == null) continue
    if (dependency.successRate < 95) {
      alerts.push({ code: `dependency_${source}_success_rate`, severity: dependency.successRate === 0 ? 'critical' : 'warning', priority: dependency.successRate === 0 ? 'P0' : 'P2', target: 'dependencies', message: `${source} 音乐源成功率低于阈值`, value: dependency.successRate, threshold: 95 })
    }
  }
  const result = {
    process: {
      uptimeSeconds: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsagePercent: processCpuUsagePercent,
      activeRequests: state.activeRequests,
      activeHandles: typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().length : null
    },
    runtime: getRuntimeDescriptor(),
    resources,
    healthScore: {
      value: healthScore,
      status: healthScore == null ? 'unknown' : healthScore < 95 ? 'error' : healthScore < 99 ? 'warning' : 'ok',
      source: '近 5 分钟 HTTP 可用率'
    },
    http: {
      windowSeconds: WINDOW_MS / 1000,
      recentRequests,
      requestsPerSecond: Number((recentRequests / (WINDOW_MS / 1000)).toFixed(3)),
      recent4xx,
      status401,
      status403,
      status429,
      recent5xx,
      p50Ms: percentile(durations, 0.5),
      p95Ms,
      p99Ms: percentile(durations, 0.99)
    },
    timeline,
    recentErrors: state.samples
      .filter((sample) => sample.status >= 400)
      .slice(-20)
      .reverse()
      .map((sample) => ({ at: new Date(sample.at).toISOString(), status: sample.status, durationMs: Math.round(sample.durationMs), route: sample.route || 'unknown', requestId: sample.requestId || null })),
    eventLoop,
    gc: {
      count: state.gc.count,
      averagePauseMs: state.gc.count ? Number((state.gc.durationMs / state.gc.count).toFixed(2)) : null
    },
    ssrPrewarm: { ...state.ssrPrewarm },
    business,
    oauth: {
      calls: state.oauthSamples.length,
      successRate: state.oauthSamples.length ? Number((oauthSuccesses / state.oauthSamples.length * 100).toFixed(2)) : null
    },
    dependencies,
    alerts,
    turnstile: { ...state.turnstile },
    notifications: { ...state.notifications },
    backups: Object.fromEntries(state.backups),
    backupSnapshot: state.backupSnapshot,
    cache: { ...state.cache },
    collectedAt: getServerDate().toISOString()
  }
  histogram.reset()
  return result
}

const isTimeoutError = (error?: string) => /timeout|timed out|etimedout|aborterror/i.test(error || '')

const persistDependencyMinuteBucket = (source: string, result: {
  success: boolean
  emptyResult?: boolean
  semanticFailure?: boolean
  durationMs: number
  retries?: number
  fallbacks?: number
  error?: string
}) => {
  const durationMs = Math.max(0, Math.round(result.durationMs))
  const timeoutCount = isTimeoutError(result.error) ? 1 : 0
  const retries = Math.max(0, Math.round(result.retries || 0))
  const fallbacks = Math.max(0, Math.round(result.fallbacks || 0))
  void getInstanceId().then((instanceId) => db.execute(sql`
    INSERT INTO operations_dependency_buckets (
      bucket_start, instance_id, source, call_count, success_count,
      empty_result_count, semantic_failure_count, timeout_count,
      retry_count, fallback_count, total_duration_ms, max_duration_ms
    ) VALUES (
      date_trunc('minute', now()), ${instanceId}, ${source.slice(0, 32)}, 1,
      ${result.success ? 1 : 0}, ${result.emptyResult ? 1 : 0},
      ${result.semanticFailure ? 1 : 0}, ${timeoutCount}, ${retries},
      ${fallbacks}, ${durationMs}, ${durationMs}
    ) ON CONFLICT (bucket_start, instance_id, source) DO UPDATE SET
      call_count = operations_dependency_buckets.call_count + 1,
      success_count = operations_dependency_buckets.success_count + EXCLUDED.success_count,
      empty_result_count = operations_dependency_buckets.empty_result_count + EXCLUDED.empty_result_count,
      semantic_failure_count = operations_dependency_buckets.semantic_failure_count + EXCLUDED.semantic_failure_count,
      timeout_count = operations_dependency_buckets.timeout_count + EXCLUDED.timeout_count,
      retry_count = operations_dependency_buckets.retry_count + EXCLUDED.retry_count,
      fallback_count = operations_dependency_buckets.fallback_count + EXCLUDED.fallback_count,
      total_duration_ms = operations_dependency_buckets.total_duration_ms + EXCLUDED.total_duration_ms,
      max_duration_ms = GREATEST(operations_dependency_buckets.max_duration_ms, EXCLUDED.max_duration_ms)
  `)).catch(() => {})
}

export const recordDependencyCall = (source: string, result: {
  success: boolean
  emptyResult?: boolean
  semanticFailure?: boolean
  durationMs: number
  retries?: number
  fallbacks?: number
  error?: string
}) => {
  const current = state.dependencies.get(source) || {
    calls: 0,
    successes: 0,
    emptyResults: 0,
    semanticFailures: 0,
    timeouts: 0,
    retries: 0,
    fallbacks: 0,
    durationMs: 0,
    durations: [],
    lastError: null
  }
  current.calls += 1
  if (result.success) current.successes += 1
  if (result.emptyResult) current.emptyResults += 1
  if (result.semanticFailure) current.semanticFailures += 1
  if (isTimeoutError(result.error)) current.timeouts += 1
  current.retries += Math.max(0, Math.round(result.retries || 0))
  current.fallbacks += Math.max(0, Math.round(result.fallbacks || 0))
  const durationMs = Math.max(0, result.durationMs)
  current.durationMs += durationMs
  current.durations.push(durationMs)
  if (current.durations.length > 500) current.durations.splice(0, current.durations.length - 500)
  current.lastError = result.success ? null : result.error || current.lastError
  state.dependencies.set(source, current)
  persistDependencyMinuteBucket(source, result)
}

export const recordTurnstileValidation = (result: 'success' | 'validation_failure' | 'upstream_failure') => {
  state.turnstile.calls += 1
  if (result === 'success') state.turnstile.successes += 1
  if (result === 'validation_failure') state.turnstile.validationFailures += 1
  if (result === 'upstream_failure') state.turnstile.upstreamFailures += 1
}

export const recordNotificationDelivery = (channel: 'smtp' | 'meow', result: 'accepted' | 'eligible' | 'skipped' | 'failure') => {
  if (channel === 'smtp') {
    if (result === 'accepted') state.notifications.smtpAccepted += 1
    if (result === 'failure') state.notifications.smtpFailures += 1
    return
  }
  if (result === 'eligible') state.notifications.meowEligible += 1
  if (result === 'skipped') state.notifications.meowSkipped += 1
  if (result === 'failure') state.notifications.meowTransportFailures += 1
}

export const recordBackupTarget = (target: string, success: boolean, durationMs: number) => {
  const current = state.backups.get(target) || { successes: 0, failures: 0, durationMs: 0 }
  if (success) current.successes += 1
  else current.failures += 1
  current.durationMs += Math.max(0, durationMs)
  state.backups.set(target, current)
}

export const recordBackupSnapshot = (snapshot: { exportedTables: number; skippedTables: number; checksum: string }) => {
  state.backupSnapshot = { ...snapshot, collectedAt: getServerDate().toISOString() }
}

export const recordCacheAccess = (hit: boolean) => {
  if (hit) state.cache.hits += 1
  else state.cache.misses += 1
}

export const recordCacheEviction = () => {
  state.cache.evictions += 1
}

export const recordSsrPrewarm = (success: boolean, durationMs: number) => {
  state.ssrPrewarm.attempts += 1
  if (success) state.ssrPrewarm.successes += 1
  else state.ssrPrewarm.failures += 1
  state.ssrPrewarm.lastDurationMs = Math.max(0, Math.round(durationMs))
  state.ssrPrewarm.lastResult = success ? 'success' : 'failure'
}

export const recordBusinessOperation = (operation: 'song_request' | 'schedule_save' | 'vote', success: boolean) => {
  state.businessSamples.push({ at: getServerTimestamp(), operation, success })
  prune()
}

export const recordOAuthOperation = (success: boolean) => {
  state.oauthSamples.push({ at: getServerTimestamp(), success })
  prune()
}
