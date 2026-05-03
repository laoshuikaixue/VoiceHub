/**
 * 验证码与风控计数器统一存储适配器
 * - 优先 Redis
 * - Redis 不可用时回退到内存 Map（适合 Docker 单进程，Serverless 冷启动也可接受）
 */
let redisClient: any = null
const memoryStore = new Map<string, { value: string; expiresAt: number }>()

async function getRedis() {
  if (redisClient !== undefined) return redisClient
  try {
    const { useRedis } = await import('~~/server/utils/redis')
    redisClient = useRedis()
    if (redisClient) {
      await redisClient.ping()
    }
  } catch {
    redisClient = null
  }
  return redisClient
}

/** 设置键值，ttlSeconds 过期秒数 */
export async function setStore(key: string, value: string, ttlSeconds: number) {
  const redis = await getRedis()
  if (redis) {
    await redis.set(key, value, 'EX', ttlSeconds)
  } else {
    memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }
}

/** 获取键值，过期返回 null */
export async function getStore(key: string): Promise<string | null> {
  const redis = await getRedis()
  if (redis) {
    return await redis.get(key)
  }
  const item = memoryStore.get(key)
  if (item && Date.now() < item.expiresAt) return item.value
  memoryStore.delete(key)
  return null
}

/** 删除键 */
export async function delStore(key: string) {
  const redis = await getRedis()
  if (redis) {
    await redis.del(key)
  } else {
    memoryStore.delete(key)
  }
}

/** 递增键值（用于失败计数），返回递增后的值 */
export async function incrStore(key: string, ttlSeconds: number): Promise<number> {
  const redis = await getRedis()
  if (redis) {
    const val = await redis.incr(key)
    await redis.expire(key, ttlSeconds)
    return val
  }
  const item = memoryStore.get(key)
  const newVal = (item ? parseInt(item.value) + 1 : 1).toString()
  memoryStore.set(key, { value: newVal, expiresAt: Date.now() + ttlSeconds * 1000 })
  return parseInt(newVal)
}

/** 删除键并返回被删除值（用于验证码一次使用） */
export async function getAndDelStore(key: string): Promise<string | null> {
  const redis = await getRedis()
  if (redis) {
    const val = await redis.get(key)
    if (val) await redis.del(key)
    return val
  }
  const item = memoryStore.get(key)
  memoryStore.delete(key)
  if (item && Date.now() < item.expiresAt) return item.value
  return null
}
