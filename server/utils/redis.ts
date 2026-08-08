import { createClient, type RedisClientType } from 'redis'

const DEFAULT_KEY_PREFIX = 'voicehub:v2:'
const CONNECT_TIMEOUT_MS = 5000
const MAX_CONNECT_RETRIES = 2

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null
let lastError: string | null = null
let lastConnectedAt: Date | null = null
let metricsCache: { expiresAt: number; value: RedisRuntimeMetrics } | null = null
const commandLatencySamples = new Map<string, { durations: number[]; errors: number }>()
const instrumentedClients = new WeakMap<object, RedisClientType>()

type RedisRuntimeMetrics = {
  probeLatencyMs: number
  memoryUsedBytes: number | null
  memoryPeakBytes: number | null
  memoryFragmentationRatio: number | null
  connectedClients: number | null
  blockedClients: number | null
  totalCommandsProcessed: number | null
  keyspaceHits: number | null
  keyspaceMisses: number | null
  hitRate: number | null
  evictedKeys: number | null
  evictionPolicy: string | null
  uptimeSeconds: number | null
  commandMetrics: Array<{
    command: string
    calls: number
    averageLatencyUs: number | null
    p50LatencyUs: number | null
    p99LatencyUs: number | null
    errors: number
  }>
}

const instrumentRedisClient = (redisClient: RedisClientType) => {
  const existing = instrumentedClients.get(redisClient as object)
  if (existing) return existing
  const excluded = new Set(['connect', 'quit', 'disconnect', 'destroy', 'info', 'ping', 'configget', 'on', 'once', 'off'])
  const proxy = new Proxy(redisClient as any, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (typeof value !== 'function') return value
      const command = String(property).toLowerCase()
      if (excluded.has(command)) return value.bind(target)
      return async (...args: any[]) => {
        const startedAt = performance.now()
        try {
          return await value.apply(target, args)
        } catch (error) {
          const sample = commandLatencySamples.get(command) || { durations: [], errors: 0 }
          sample.errors += 1
          commandLatencySamples.set(command, sample)
          throw error
        } finally {
          const sample = commandLatencySamples.get(command) || { durations: [], errors: 0 }
          sample.durations.push(Math.max(0, performance.now() - startedAt))
          if (sample.durations.length > 200) sample.durations.splice(0, sample.durations.length - 200)
          commandLatencySamples.set(command, sample)
        }
      }
    }
  }) as RedisClientType
  instrumentedClients.set(redisClient as object, proxy)
  return proxy
}

export const isRedisConfigured = () => Boolean(process.env.REDIS_URL?.trim())

export const getRedisKeyPrefix = () => {
  const configuredPrefix = process.env.REDIS_KEY_PREFIX?.trim()
  const prefix = configuredPrefix || DEFAULT_KEY_PREFIX
  return prefix.endsWith(':') ? prefix : `${prefix}:`
}

export const buildRedisKey = (...parts: Array<string | number>) =>
  `${getRedisKeyPrefix()}${parts.map((part) => String(part)).join(':')}`

const createRedisClient = () => {
  const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) =>
        retries >= MAX_CONNECT_RETRIES
          ? new Error('Redis 短期状态服务连接重试次数已用尽')
          : Math.min(250 * 2 ** retries, 5000)
    },
    disableOfflineQueue: true
  })

  redisClient.on('ready', () => {
    lastError = null
    lastConnectedAt = new Date()
    console.log('[Redis] 分布式短期状态服务已就绪')
  })

  redisClient.on('error', (error) => {
    lastError = error.message
    console.error('[Redis] 连接错误:', error.message)
  })

  redisClient.on('reconnecting', () => {
    console.warn('[Redis] 正在重新连接短期状态服务')
  })

  return redisClient as RedisClientType
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!isRedisConfigured()) return null
  if (client?.isReady) return instrumentRedisClient(client)
  if (connectPromise) return await connectPromise

  if (!client || !client.isOpen) {
    client = createRedisClient()
  }

  connectPromise = (async () => {
    try {
      if (!client!.isOpen) {
        await client!.connect()
      }
      return client!.isReady ? instrumentRedisClient(client!) : null
    } catch (error: any) {
      lastError = error?.message || String(error)
      console.error('[Redis] 连接失败:', lastError)
      if (client?.isOpen) client.destroy()
      client = null
      return null
    } finally {
      connectPromise = null
    }
  })()

  return await connectPromise
}

export const isRedisReady = () => Boolean(client?.isReady)

export async function disconnectRedis(): Promise<void> {
  if (!client?.isOpen) return

  try {
    await client.quit()
  } catch {
    client.destroy()
  } finally {
    client = null
    connectPromise = null
    metricsCache = null
  }
}

export const getRedisStats = () => ({
  configured: isRedisConfigured(),
  connected: Boolean(client?.isReady),
  keyPrefix: getRedisKeyPrefix(),
  lastConnectedAt,
  lastError
})

const parseRedisInfo = (raw: string) => Object.fromEntries(
  raw.split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes(':'))
    .map((line) => {
      const index = line.indexOf(':')
      return [line.slice(0, index), line.slice(index + 1)]
    })
)

const numericInfoValue = (info: Record<string, string>, key: string) => {
  const value = Number(info[key])
  return Number.isFinite(value) ? value : null
}

export async function getRedisMetrics() {
  const base = getRedisStats()
  if (!base.configured) return { ...base, metrics: null }

  const now = Date.now()
  if (metricsCache && metricsCache.expiresAt > now) {
    return { ...getRedisStats(), metrics: metricsCache.value }
  }

  const redis = await getRedisClient()
  if (!redis) return { ...getRedisStats(), metrics: null }

  try {
    const probeStartedAt = performance.now()
    await redis.ping()
    const probeLatencyMs = Math.max(0, Math.round(performance.now() - probeStartedAt))
    const [memoryRaw, statsRaw, clientsRaw, serverRaw, commandStatsRaw, configRaw] = await Promise.all([
      redis.info('memory'),
      redis.info('stats'),
      redis.info('clients'),
      redis.info('server'),
      redis.info('commandstats'),
      redis.configGet('maxmemory-policy').catch((): Record<string, string> => ({}))
    ])
    const memory = parseRedisInfo(memoryRaw)
    const stats = parseRedisInfo(statsRaw)
    const clients = parseRedisInfo(clientsRaw)
    const server = parseRedisInfo(serverRaw)
    const commandStats = parseRedisInfo(commandStatsRaw)
    const percentile = (values: number[], ratio: number) => {
      const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
      return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] : null
    }
    const commandMetrics = Object.entries(commandStats)
      .filter(([key]) => key.startsWith('cmdstat_'))
      .map(([key, value]) => {
        const fields = Object.fromEntries(value.split(',').map((part) => {
          const [name, raw] = part.split('=')
          return [name, Number(raw)]
        }))
        const calls = Number(fields.calls)
        const usecPerCall = Number(fields.usec_per_call)
        const command = key.slice('cmdstat_'.length)
        const sample = commandLatencySamples.get(command) || { durations: [], errors: 0 }
        const p50Ms = percentile(sample.durations, 0.5)
        const p99Ms = percentile(sample.durations, 0.99)
        return {
          command,
          calls: Number.isFinite(calls) ? calls : 0,
          averageLatencyUs: Number.isFinite(usecPerCall) ? usecPerCall : null,
          p50LatencyUs: p50Ms != null ? Number((p50Ms * 1000).toFixed(2)) : null,
          p99LatencyUs: p99Ms != null ? Number((p99Ms * 1000).toFixed(2)) : null,
          errors: Math.max((Number(fields.failed_calls) || 0) + (Number(fields.rejected_calls) || 0), sample.errors)
        }
      })
      .sort((left, right) => right.calls - left.calls)
      .slice(0, 20)
    const keyspaceHits = numericInfoValue(stats, 'keyspace_hits')
    const keyspaceMisses = numericInfoValue(stats, 'keyspace_misses')
    const hitTotal = (keyspaceHits || 0) + (keyspaceMisses || 0)
    const metrics: RedisRuntimeMetrics = {
      probeLatencyMs,
      memoryUsedBytes: numericInfoValue(memory, 'used_memory'),
      memoryPeakBytes: numericInfoValue(memory, 'used_memory_peak'),
      memoryFragmentationRatio: numericInfoValue(memory, 'mem_fragmentation_ratio'),
      connectedClients: numericInfoValue(clients, 'connected_clients'),
      blockedClients: numericInfoValue(clients, 'blocked_clients'),
      totalCommandsProcessed: numericInfoValue(stats, 'total_commands_processed'),
      keyspaceHits,
      keyspaceMisses,
      hitRate: hitTotal ? Number((Number(keyspaceHits || 0) / hitTotal * 100).toFixed(2)) : null,
      evictedKeys: numericInfoValue(stats, 'evicted_keys'),
      evictionPolicy: configRaw['maxmemory-policy'] || null,
      uptimeSeconds: numericInfoValue(server, 'uptime_in_seconds'),
      commandMetrics
    }
    metricsCache = { value: metrics, expiresAt: now + 15_000 }
    return { ...getRedisStats(), metrics }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    return { ...getRedisStats(), metrics: null }
  }
}
