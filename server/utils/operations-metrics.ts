import { PerformanceObserver, monitorEventLoopDelay, performance } from 'node:perf_hooks'

const WINDOW_MS = 5 * 60 * 1000
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 })
eventLoopHistogram.enable()

const state = {
  startedAt: Date.now(),
  totalRequests: 0,
  clientErrors: 0,
  serverErrors: 0,
  activeRequests: 0,
  samples: [] as Array<{ at: number; status: number; durationMs: number; route?: string; requestId?: string }>,
  requestContext: new Map<number, { route?: string; requestId?: string }>(),
  businessSamples: [] as Array<{ at: number; operation: string; success: boolean }>,
  oauthSamples: [] as Array<{ at: number; success: boolean }>,
  dependencies: new Map<string, { calls: number; successes: number; emptyResults: number; semanticFailures: number; durationMs: number; lastError: string | null }>(),
  turnstile: { calls: 0, successes: 0, upstreamFailures: 0, validationFailures: 0 },
  notifications: { smtpAccepted: 0, smtpFailures: 0, meowEligible: 0, meowSkipped: 0, meowTransportFailures: 0 },
  backups: new Map<string, { successes: number; failures: number; durationMs: number }>(),
  backupSnapshot: null as null | { exportedTables: number; skippedTables: number; checksum: string; collectedAt: string },
  cache: { hits: 0, misses: 0, evictions: 0 },
  gc: { count: 0, durationMs: 0 },
  ssrPrewarm: { attempts: 0, successes: 0, failures: 0, lastDurationMs: null as number | null, lastResult: null as string | null }
}

const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    state.gc.count += 1
    state.gc.durationMs += entry.duration
  }
})
gcObserver.observe({ entryTypes: ['gc'] })

const prune = () => {
  const cutoff = Date.now() - WINDOW_MS
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
  state.samples.push({ at: Date.now(), status: statusCode, durationMs, ...context })
  if (state.samples.length > 5000) state.samples = state.samples.slice(-5000)
  prune()
}

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
}

export const getOperationsMetrics = () => {
  prune()
  const durations = state.samples.map((sample) => sample.durationMs)
  const recentRequests = state.samples.length
  const recent5xx = state.samples.filter((sample) => sample.status >= 500).length
  const recent4xx = state.samples.filter((sample) => sample.status >= 400 && sample.status < 500).length
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
    const start = Date.now() - WINDOW_MS + index * bucketSize
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
  const result = {
    process: {
      uptimeSeconds: process.uptime(),
      memory: process.memoryUsage(),
      activeRequests: state.activeRequests,
      activeHandles: typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().length : null
    },
    http: {
      windowSeconds: WINDOW_MS / 1000,
      recentRequests,
      requestsPerSecond: Number((recentRequests / (WINDOW_MS / 1000)).toFixed(3)),
      recent4xx,
      recent5xx,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      p99Ms: percentile(durations, 0.99)
    },
    timeline,
    recentErrors: state.samples
      .filter((sample) => sample.status >= 400)
      .slice(-20)
      .reverse()
      .map((sample) => ({ at: new Date(sample.at).toISOString(), status: sample.status, durationMs: Math.round(sample.durationMs), route: sample.route || 'unknown', requestId: sample.requestId || null })),
    eventLoop: {
      meanMs: histogram.count ? Number((Number(histogram.mean) / 1e6).toFixed(2)) : null,
      maxMs: histogram.count ? Number((Number(histogram.max) / 1e6).toFixed(2)) : null,
      p99Ms: histogram.count ? Number((Number(histogram.percentile(99)) / 1e6).toFixed(2)) : null
    },
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
    dependencies: Object.fromEntries([...state.dependencies.entries()].map(([source, item]) => ({
      [source]: {
        calls: item.calls,
        successRate: item.calls ? Number((item.successes / item.calls * 100).toFixed(2)) : null,
        emptyResultRate: item.calls ? Number((item.emptyResults / item.calls * 100).toFixed(2)) : null,
        semanticFailureRate: item.calls ? Number((item.semanticFailures / item.calls * 100).toFixed(2)) : null,
        averageDurationMs: item.calls ? Number((item.durationMs / item.calls).toFixed(2)) : null,
        lastError: item.lastError
      }
    }))),
    turnstile: { ...state.turnstile },
    notifications: { ...state.notifications },
    backups: Object.fromEntries(state.backups),
    backupSnapshot: state.backupSnapshot,
    cache: { ...state.cache },
    collectedAt: new Date().toISOString()
  }
  histogram.reset()
  return result
}

export const recordDependencyCall = (source: string, result: { success: boolean; emptyResult?: boolean; semanticFailure?: boolean; durationMs: number; error?: string }) => {
  const current = state.dependencies.get(source) || { calls: 0, successes: 0, emptyResults: 0, semanticFailures: 0, durationMs: 0, lastError: null }
  current.calls += 1
  if (result.success) current.successes += 1
  if (result.emptyResult) current.emptyResults += 1
  if (result.semanticFailure) current.semanticFailures += 1
  current.durationMs += Math.max(0, result.durationMs)
  current.lastError = result.error || current.lastError
  state.dependencies.set(source, current)
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
  state.backupSnapshot = { ...snapshot, collectedAt: new Date().toISOString() }
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
  state.businessSamples.push({ at: Date.now(), operation, success })
  prune()
}

export const recordOAuthOperation = (success: boolean) => {
  state.oauthSamples.push({ at: Date.now(), success })
  prune()
}
