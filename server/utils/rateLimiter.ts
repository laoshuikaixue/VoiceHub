// 简易的内存限流器实现，带有最大容量限制防止内存溢出
// 如果项目扩展为多实例/Serverless，建议替换为 Redis 或基于数据库的实现

interface RateLimitRecord {
  count: number
  resetTime: number
}

const MAX_STORE_SIZE = 10000 // 最大允许存储的IP记录数
const store = new Map<string, RateLimitRecord>()

/**
 * 检查并增加限流计数
 * @param key 限流的唯一键 (如 IP、用户名等)
 * @param limit 在指定时间窗口内允许的最大请求数
 * @param windowMs 时间窗口大小（毫秒）
 * @returns { isAllowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): { isAllowed: boolean, remaining: number, resetTime: number } {
  const now = Date.now()
  let record = store.get(key)

  if (!record || now > record.resetTime) {
    // 防止内存溢出：如果达到上限，清理部分旧数据
    if (store.size >= MAX_STORE_SIZE) {
      cleanupRateLimits(true)
    }

    // 记录不存在或已过期，重置计数
    record = {
      count: 1,
      resetTime: now + windowMs
    }
    store.set(key, record)
    return { isAllowed: true, remaining: limit - 1, resetTime: record.resetTime }
  }

  // 记录未过期，增加计数
  record.count++
  const remaining = Math.max(0, limit - record.count)
  const isAllowed = record.count <= limit

  return { isAllowed, remaining, resetTime: record.resetTime }
}

/**
 * 清理过期的限流记录
 * @param force 如果为 true，在没有过期数据时也会强制删除最旧的记录
 */
export function cleanupRateLimits(force = false) {
  const now = Date.now()
  let deletedCount = 0

  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key)
      deletedCount++
    }
  }

  // 如果强制清理且没有过期数据可删，则删除最早插入的记录（利用 Map 的插入顺序特性）
  if (force && deletedCount === 0 && store.size > 0) {
    const firstKey = store.keys().next().value
    if (firstKey !== undefined) {
      store.delete(firstKey)
    }
  }
}

// 尝试设置定时清理器，但在 Serverless 环境中可能不会按预期工作，所以主要依赖惰性清理
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupRateLimits(false), 60 * 60 * 1000)
}
