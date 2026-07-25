import type { RedisClientType } from 'redis'
import { createClient } from 'redis'

const DEFAULT_KEY_PREFIX = 'voicehub:v2:'
const CONNECT_TIMEOUT_MS = 5000
const MAX_CONNECT_RETRIES = 2

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null
let lastError: string | null = null
let lastConnectedAt: Date | null = null

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
  }
}

export const getRedisStats = () => ({
  configured: isRedisConfigured(),
  connected: Boolean(client?.isReady),
  keyPrefix: getRedisKeyPrefix(),
  lastConnectedAt,
  lastError
})
