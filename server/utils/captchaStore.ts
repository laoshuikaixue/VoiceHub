import { createHmac, timingSafeEqual } from 'node:crypto'
import type { RedisClientType } from 'redis'
import { buildRedisKey, getRedisClient, isRedisConfigured } from './redis'
import { getServerTimestamp } from './serverTime'

interface MemoryRecord {
  value: string
  expiresAt: number
}

export class RedisStateUnavailableError extends Error {
  statusCode = 503

  constructor() {
    super('分布式短期状态服务暂不可用，请稍后重试')
    this.name = 'RedisStateUnavailableError'
  }
}

const memoryStore = new Map<string, MemoryRecord>()
const keyOf = (key: string) => buildRedisKey('state', key)

const cleanupMemoryStore = () => {
  const now = getServerTimestamp()
  for (const [key, record] of memoryStore.entries()) {
    if (now >= record.expiresAt) memoryStore.delete(key)
  }
}

const requireRedis = async () => {
  const redis = await getRedisClient()
  if (!redis) throw new RedisStateUnavailableError()
  return redis
}

const executeRedisState = async <T>(
  operation: (redis: RedisClientType) => Promise<T>
): Promise<T> => {
  try {
    const redis = await requireRedis()
    return await operation(redis)
  } catch (error) {
    if (error instanceof RedisStateUnavailableError) throw error
    throw new RedisStateUnavailableError()
  }
}

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return value
`

const GET_AND_DELETE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
`

const COMPARE_AND_DELETE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value and value == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
`

/** 设置短期状态。配置 Redis 后，Redis 故障不会悄悄切换到另一份内存状态。 */
export async function setStore(key: string, value: string, ttlSeconds: number) {
  if (isRedisConfigured()) {
    await executeRedisState((redis) =>
      redis.set(keyOf(key), value, { EX: Math.max(1, Math.floor(ttlSeconds)) })
    )
    return
  }

  cleanupMemoryStore()
  memoryStore.set(key, {
    value,
    expiresAt: getServerTimestamp() + Math.max(1, ttlSeconds) * 1000
  })
}

export async function getStore(key: string): Promise<string | null> {
  if (isRedisConfigured()) {
    return await executeRedisState((redis) => redis.get(keyOf(key)))
  }

  cleanupMemoryStore()
  const record = memoryStore.get(key)
  return record ? record.value : null
}

export async function delStore(key: string) {
  if (isRedisConfigured()) {
    await executeRedisState((redis) => redis.del(keyOf(key)))
    return
  }

  memoryStore.delete(key)
}

/** 递增键值并仅在第一次递增时设置过期时间。 */
export async function incrStore(key: string, ttlSeconds: number): Promise<number> {
  if (isRedisConfigured()) {
    const result = await executeRedisState((redis) =>
      redis.eval(INCREMENT_WITH_EXPIRY_SCRIPT, {
        keys: [keyOf(key)],
        arguments: [String(Math.max(1, Math.floor(ttlSeconds)))]
      })
    )
    return Number(result)
  }

  cleanupMemoryStore()
  const existing = memoryStore.get(key)
  const current = Number(existing?.value || 0) + 1
  memoryStore.set(key, {
    value: String(current),
    expiresAt: existing?.expiresAt ?? getServerTimestamp() + Math.max(1, ttlSeconds) * 1000
  })
  return current
}

/** 原子读取并删除键，用于一次性验证码。 */
export async function getAndDelStore(key: string): Promise<string | null> {
  if (isRedisConfigured()) {
    const result = await executeRedisState((redis) =>
      redis.eval(GET_AND_DELETE_SCRIPT, {
        keys: [keyOf(key)],
        arguments: []
      })
    )
    return result === null ? null : String(result)
  }

  cleanupMemoryStore()
  const record = memoryStore.get(key)
  memoryStore.delete(key)
  return record ? record.value : null
}

/** 仅当值未被其他请求改变时删除，用于防止一次性验证码并发重复消费。 */
export async function delStoreIfValue(key: string, expectedValue: string): Promise<boolean> {
  if (isRedisConfigured()) {
    const result = await executeRedisState((redis) =>
      redis.eval(COMPARE_AND_DELETE_SCRIPT, {
        keys: [keyOf(key)],
        arguments: [expectedValue]
      })
    )
    return Number(result) === 1
  }

  cleanupMemoryStore()
  const record = memoryStore.get(key)
  if (!record || record.value !== expectedValue) return false
  memoryStore.delete(key)
  return true
}

/** 安全解析短期状态 JSON，拒绝旧明文、数组和损坏数据。 */
export function parseStoreJson<T extends object>(value: string | null): T | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as T
  } catch {
    return null
  }
}

const getCodeSecret = () => {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return secret
}

export function hashStateCode(scope: string, code: string) {
  return createHmac('sha256', getCodeSecret()).update(`${scope}:${code}`).digest('hex')
}

export function verifyStateCode(scope: string, code: string, expectedHash: string) {
  const actual = Buffer.from(hashStateCode(scope, code), 'utf8')
  const expected = Buffer.from(expectedHash, 'utf8')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
