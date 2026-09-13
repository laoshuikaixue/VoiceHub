/**
 * RBAC 缓存（进程内 LRU + 主动失效）
 *
 * 单实例假设（spec [S10] 标 [future]）：进程内 Map 足够。
 * 多实例部署需引入 Redis Pub/Sub 广播失效事件，本期不实现。
 */

import type { PermissionKey } from './constants'

type CacheEntry = {
  permissions: Set<PermissionKey>
  expiresAt: number
}

const TTL_MS = 60_000
const cache = new Map<number, CacheEntry>()

// in-flight promise 去重（防并发击穿）
const inflight = new Map<number, Promise<Set<PermissionKey>>>()

function isExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.expiresAt
}

export const rbacCache = {
  get(userId: number): Set<PermissionKey> | null {
    const entry = cache.get(userId)
    if (!entry) return null
    if (isExpired(entry)) {
      cache.delete(userId)
      return null
    }
    return entry.permissions
  },

  set(userId: number, permissions: Set<PermissionKey>): void {
    cache.set(userId, {
      permissions,
      expiresAt: Date.now() + TTL_MS
    })
  },

  /**
   * 加载用户权限（带 in-flight 去重）
   * @param loader 实际加载函数，由调用方提供
   */
  async load(
    userId: number,
    loader: () => Promise<Set<PermissionKey>>
  ): Promise<Set<PermissionKey>> {
    const cached = this.get(userId)
    if (cached) return cached

    const pending = inflight.get(userId)
    if (pending) return pending

    const promise = (async () => {
      try {
        const permissions = await loader()
        this.set(userId, permissions)
        return permissions
      } finally {
        inflight.delete(userId)
      }
    })()
    inflight.set(userId, promise)
    return promise
  },

  /** 失效单个用户的缓存 */
  invalidate(userId: number): void {
    cache.delete(userId)
  },

  /** 失效全部（角色权限矩阵变更时调用） */
  invalidateAll(): void {
    cache.clear()
  }
}
