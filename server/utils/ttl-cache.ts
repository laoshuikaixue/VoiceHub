import { getServerTimestamp } from './serverTime.ts'

/**
 * 模块级 TTL 缓存，带 in-flight 去重。
 * load 返回 null 表示读取失败或无数据，此时返回 fallback 且不写缓存，下次调用重新读取。
 * 用于渲染热路径上需复用系统设置配置的场合，避免每个请求都查库。
 */
export function createTtlCache<T>(
  load: () => Promise<T | null>,
  fallback: T,
  ttlMs: number
): () => Promise<T> {
  let cached: T | null = null
  let expiresAt = 0
  let pending: Promise<T> | null = null

  return async () => {
    if (cached !== null && getServerTimestamp() < expiresAt) {
      return cached
    }

    if (!pending) {
      pending = (async () => {
        try {
          const value = await load()
          if (value === null) {
            return fallback
          }
          cached = value
          expiresAt = getServerTimestamp() + ttlMs
          return value
        } finally {
          pending = null
        }
      })()
    }

    return pending
  }
}
