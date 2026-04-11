// 简易的内存限流器实现，适用于单实例部署。
// 如果项目扩展为多实例/Serverless，建议替换为 Redis 或基于数据库的实现

interface RateLimitRecord {
  count: number
  resetTime: number
}

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
 * 清理过期的限流记录（可定期调用以防止内存泄漏）
 */
export function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key)
    }
  }
}

// 每小时自动清理一次过期记录
setInterval(cleanupRateLimits, 60 * 60 * 1000)
