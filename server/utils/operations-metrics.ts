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
  samples: [] as Array<{ at: number; status: number; durationMs: number }>
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
    collectedAt: new Date().toISOString()
  }
  histogram.reset()
  return result
}
