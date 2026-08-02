import { monitorEventLoopDelay, performance } from 'node:perf_hooks'

const WINDOW_MS = 5 * 60 * 1000
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 })
eventLoopHistogram.enable()

const state = {
  startedAt: Date.now(),
  totalRequests: 0,
  clientErrors: 0,
  serverErrors: 0,
  activeRequests: 0,
  samples: [] as Array<{ at: number; status: number; durationMs: number }>,
  dependencies: new Map<string, { calls: number; successes: number; emptyResults: number; semanticFailures: number; durationMs: number; lastError: string | null }>(),
  turnstile: { calls: 0, successes: 0, upstreamFailures: 0, validationFailures: 0 },
  notifications: { smtpAccepted: 0, smtpFailures: 0, meowEligible: 0, meowSkipped: 0, meowTransportFailures: 0 },
  backups: new Map<string, { successes: number; failures: number; durationMs: number }>()
}

const prune = () => {
  const cutoff = Date.now() - WINDOW_MS
  state.samples = state.samples.filter((sample) => sample.at >= cutoff)
}

export const startOperationRequest = () => {
  state.activeRequests += 1
  return performance.now()
}

export const finishOperationRequest = (startedAt: number, statusCode: number) => {
  const durationMs = Math.max(0, performance.now() - startedAt)
  state.activeRequests = Math.max(0, state.activeRequests - 1)
  state.totalRequests += 1
  if (statusCode >= 400 && statusCode < 500) state.clientErrors += 1
  if (statusCode >= 500) state.serverErrors += 1
  state.samples.push({ at: Date.now(), status: statusCode, durationMs })
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
  const histogram = eventLoopHistogram
  const result = {
    process: {
      uptimeSeconds: process.uptime(),
      memory: process.memoryUsage(),
      activeRequests: state.activeRequests
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
    eventLoop: {
      meanMs: histogram.count ? Number((Number(histogram.mean) / 1e6).toFixed(2)) : null,
      maxMs: histogram.count ? Number((Number(histogram.max) / 1e6).toFixed(2)) : null,
      p99Ms: histogram.count ? Number((Number(histogram.percentile(99)) / 1e6).toFixed(2)) : null
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
