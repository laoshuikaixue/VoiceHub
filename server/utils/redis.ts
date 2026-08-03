import type { RedisClientType } from 'redis'
import { createClient } from 'redis'

const DEFAULT_KEY_PREFIX = 'voicehub:v2:'
const CONNECT_TIMEOUT_MS = 5000
const MAX_CONNECT_RETRIES = 2

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null
let lastError: string | null = null
let lastConnectedAt: Date | null = null
let metricsCache: { expiresAt: number; value: RedisRuntimeMetrics } | null = null

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
  if (client?.isReady) return client
  if (connectPromise) return await connectPromise

  if (!client || !client.isOpen) {
    client = createRedisClient()
  }

  connectPromise = (async () => {
    try {
      if (!client!.isOpen) {
        await client!.connect()
      }
      return client!.isReady ? client : null
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
    const [memoryRaw, statsRaw, clientsRaw, serverRaw, configRaw] = await Promise.all([
      redis.info('memory'),
      redis.info('stats'),
      redis.info('clients'),
      redis.info('server'),
      redis.configGet('maxmemory-policy').catch((): Record<string, string> => ({}))
    ])
    const memory = parseRedisInfo(memoryRaw)
    const stats = parseRedisInfo(statsRaw)
    const clients = parseRedisInfo(clientsRaw)
    const server = parseRedisInfo(serverRaw)
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
      uptimeSeconds: numericInfoValue(server, 'uptime_in_seconds')
    }
    metricsCache = { value: metrics, expiresAt: now + 15_000 }
    return { ...getRedisStats(), metrics }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    return { ...getRedisStats(), metrics: null }
  }
}
