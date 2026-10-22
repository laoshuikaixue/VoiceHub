/**
 * RBAC 缓存实现：进程内 Map + TTL + in-flight 去重 + 主动失效（S2-1 · R-12 / R-13）
 *
 * 单实例假设：进程内 Map 足够；多实例需 Redis Pub/Sub 广播失效事件，本期不实现（总纲已记录）。
 *
 * 时钟注入：内核禁止 `Date.now()` / `new Date()`（S2 DoD；也是 AGENTS.md §2.6 的口径）。
 *   生产用 `serverTime` 的 `getServerTimestamp()`；单测用 `createPermissionCache({ now })`
 *   注入假时钟，不依赖真实等待。
 *
 * `store` 谓词：调用方可以拒绝缓存某些结果（如种子未就位时的 degraded 态 —— 缓存它会
 *   把「降级」变成「无权」，且修复后要等 TTL 才恢复）。
 *
 * 本模块必须能被 plain node 直接 import（`tests/**` 走 `node --experimental-strip-types --test`，
 * 没有 Nuxt 别名解析器），故内部用相对路径 + 显式 `.ts` 扩展名。
 */

import { getServerTimestamp } from '../serverTime.ts'

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export type PermissionCacheOptions = {
  /** TTL（毫秒），默认 60s */
  ttlMs?: number
  /** 时钟注入（单测用） */
  now?: () => number
}

export type CacheLoadOptions<T> = {
  /** 返回 false 表示本条结果不入缓存（仍会参与 in-flight 去重） */
  store?: (value: T) => boolean
}

export const DEFAULT_TTL_MS = 60_000

export function createPermissionCache<T>(options: PermissionCacheOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const now = options.now ?? getServerTimestamp

  const cache = new Map<number, CacheEntry<T>>()
  const inflight = new Map<number, Promise<T>>()

  function get(userId: number): T | null {
    const entry = cache.get(userId)
    if (!entry) return null
    if (now() > entry.expiresAt) {
      cache.delete(userId)
      return null
    }
    return entry.value
  }

  function set(userId: number, value: T): void {
    cache.set(userId, { value, expiresAt: now() + ttlMs })
  }

  /** 加载（命中缓存直接返回；并发同 userId 复用同一 in-flight promise） */
  async function load(userId: number, loader: () => Promise<T>, loadOptions: CacheLoadOptions<T> = {}): Promise<T> {
    const cached = get(userId)
    if (cached !== null) return cached

    const pending = inflight.get(userId)
    if (pending) return pending

    const promise = (async () => {
      try {
        const value = await loader()
        if (!loadOptions.store || loadOptions.store(value)) set(userId, value)
        return value
      } finally {
        inflight.delete(userId)
      }
    })()
    inflight.set(userId, promise)
    return promise
  }

  /** 失效单个用户（个人加授 / 减授变更后必须在事务内调用） */
  function invalidate(userId: number): void {
    cache.delete(userId)
  }

  /** 失效全部（角色权限矩阵变更后调用） */
  function invalidateAll(): void {
    cache.clear()
  }

  return {
    get,
    set,
    load,
    invalidate,
    invalidateAll,
    size: () => cache.size,
    inflightSize: () => inflight.size
  }
}

export type PermissionCache<T> = ReturnType<typeof createPermissionCache<T>>

