/**
 * 验证码与风控计数器统一存储适配器
 * - 优先 Redis
 * - Redis 不可用时回退到内存 Map（适合 Docker 单进程，Serverless 冷启动也可接受）
 */
let redisClient: any = undefined
const memoryStore = new Map<string, { value: string; expiresAt: number }>()

// 定期清理过期的内存数据，防止无 Redis 环境下的内存泄漏
const timer = setInterval(() => {
  const now = Date.now()
  for (const [key, item] of memoryStore.entries()) {
    if (now > item.expiresAt) {
      memoryStore.delete(key)
    }
  }
}, 60 * 1000) // 每分钟清理一次
if (timer.unref) {
  timer.unref()
}

async function getRedis() {
  if (redisClient !== undefined) return redisClient
  try {
    const redisModule = await import('~~/server/utils/redis')
    redisClient = redisModule.useRedis()
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
    // 使用 MULTI 事务确保 incr 和 expire 的原子性，避免内存泄漏
    const results = await redis.multi().incr(key).expire(key, ttlSeconds).exec()
    if (results && results[0]) {
      const [, val] = results[0] as [Error | null, any]
      return Number(val)
    }
    return 1
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
    try {
      // 优先尝试使用 Redis 6.2+ 引入的 GETDEL 命令实现原子操作
      return await redis.getdel(key)
    } catch (e) {
      // 如果使用的 Redis 版本较旧不支持 GETDEL，回退为使用 MULTI 事务
      const results = await redis.multi().get(key).del(key).exec()
      // ioredis 的 exec 返回结构通常是 [[error, result], [error, result]]
      if (results && results[0]) {
        const [, val] = results[0] as [Error | null, any]
        return val as string | null
      }
      return null
    }
  }
  
  // 无 Redis 环境，回退到内存 Map
  const item = memoryStore.get(key)
  memoryStore.delete(key)
  if (item && Date.now() < item.expiresAt) return item.value
  return null
}
