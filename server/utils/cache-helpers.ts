import { executeRedisCommand, isRedisReady } from './redis'
import { cacheService } from '../services/cacheService'

// 缓存策略：永久缓存，数据修改时主动失效

// 缓存键前缀
export const CACHE_PREFIXES = {
  SYSTEM: 'sys:',
  USER: 'user:',
  SCHEDULE: 'schedule:',
  SONG: 'song:',
  STATS: 'stats:',
  AUTH: 'auth:',
  VOTE: 'vote:'
} as const

/**
 * 全局认证缓存版本号键
 *
 * 用于实现基于版本号（Version Tag）的全局认证缓存失效机制，替代 Redis KEYS 命令。
 *
 * --- 工作原理 ---
 * setAuth(userId, data) 写入时在 data 中附加当前全局版本号 _v
 * getAuth(userId) 读取时对比缓存 _v 与全局版本号，不一致则视为未命中
 * clearAllAuth() 改为 INCR 版本号（O(1)），不再执行 KEYS（O(N) blocking）
 *
 * --- 性能对比 ---
 * KEYS 方案: O(N)，N=用户数。100k 用户约需 700ms+（blocking 风险）
 * Version Tag 方案: O(1) INCR，约 0.3ms（恒定）
 *
 * --- 兼容性 ---
 * 旧格式缓存 _v 缺失 → 直接返回（不校验），渐进迁移到新格式
 */
const AUTH_GLOBAL_VERSION_KEY = 'auth:global-version'

/**
 * 内存中缓存全局认证版本号，避免每次 getAuth/setAuth 都穿透到 Redis。
 *
 * 版本号变更频率极低（仅在管理员修改系统设置中的"首次登录强制改密"开关时触发），
 * 因此 3 秒的本地缓存足够确保高并发场景下的性能，同时不会对配置修改的即时生效
 * 产生可感知的延迟。
 *
 * --- 缓存刷新策略 ---
 * - getAuth / setAuth 读取全局版本号时优先使用本地缓存（3 秒 TTL）
 * - clearAllAuth 执行 INCR 后直接更新本地缓存，跳过 TTL 等待
 * - Redis 不可用时清除本地缓存，回退到每次都从内存缓存读取
 */
let cachedGlobalVersion: string | null = null
let cachedGlobalVersionTime = 0
const GLOBAL_VERSION_CACHE_TTL = 3000 // 3 秒

/**
 * 获取全局认证缓存版本号（带内存缓存）。
 * 优先返回本地缓存中的版本号，过期后从 Redis 重新读取。
 */
async function getGlobalVersion(): Promise<string | null> {
  // 以时间戳是否已初始化（cachedGlobalVersionTime !== 0）作为判断依据，而非版本号是否为 null。
  // 否则当 Redis 尚未初始化 AUTH_GLOBAL_VERSION_KEY 时，cache.get 返回 null，
  // 会导致内存缓存始终判定为未命中，每次请求都穿透到 Redis。
  if (
    cachedGlobalVersionTime !== 0 &&
    Date.now() - cachedGlobalVersionTime < GLOBAL_VERSION_CACHE_TTL
  ) {
    return cachedGlobalVersion
  }
  const version = await cache.get<string>(AUTH_GLOBAL_VERSION_KEY)
  cachedGlobalVersion = version
  cachedGlobalVersionTime = Date.now()
  return version
}

// 统一缓存操作接口
export class CacheHelper {
  private static cacheVersions = new Map<string, string>() // 缓存版本管理

  /**
   * 获取缓存数据，优先从Redis获取，fallback到CacheService
   */
  static async get<T>(key: string, fallbackToMemory = true): Promise<T | null> {
    try {
      // 优先尝试Redis
      if (isRedisReady()) {
        const result = await executeRedisCommand(
          async () => {
            const client = (await import('./redis')).getRedisClient()
            if (!client) return null
            const data = await client.get(key)
            return data ? JSON.parse(data) : null
          },
          async () => null
        )

        if (result !== null) {
          return result as T
        }
      }

      // Redis未命中或不可用，尝试内存缓存
      if (fallbackToMemory) {
        return await cacheService.getCache<T>(key)
      }

      return null
    } catch (error) {
      console.error(`[CacheHelper] 获取缓存失败 ${key}:`, error)
      return null
    }
  }

  /**
   * 设置缓存（永久缓存）
   */
  static async set<T>(key: string, value: T, version?: string): Promise<boolean> {
    try {
      let redisSuccess = false
      let memorySuccess = false
      const currentVersion = version || this.generateVersion()

      // 尝试写入Redis（永久缓存）
      if (isRedisReady()) {
        redisSuccess = await executeRedisCommand(
          async () => {
            const client = (await import('./redis')).getRedisClient()
            if (!client) return false
            await client.set(key, JSON.stringify(value))
            if (version) {
              await client.set(`${key}:version`, currentVersion)
            }
            return true
          },
          async () => false
        )
      }

      // 不使用内存缓存的setCache方法，因为它是private且需要TTL
      // 对于永久缓存策略，只使用Redis，内存缓存作为fallback读取
      memorySuccess = true // 标记为成功，因为我们主要依赖Redis

      // 更新版本记录
      if (version) {
        this.cacheVersions.set(key, currentVersion)
      }

      return redisSuccess || memorySuccess
    } catch (error) {
      console.error(`[CacheHelper] 设置缓存失败 ${key}:`, error)
      return false
    }
  }

  /**
   * 删除缓存数据
   */
  static async delete(key: string): Promise<boolean> {
    try {
      let redisSuccess = false
      let memorySuccess = false

      // 从Redis删除
      if (isRedisReady()) {
        redisSuccess =
          (await executeRedisCommand(
            async () => {
              const client = (await import('./redis')).getRedisClient()
              if (!client) return false
              await client.del(key)
              return true
            },
            async () => false
          )) || false
      }

      // 从内存缓存删除
      try {
        await cacheService.deleteCache(key)
        memorySuccess = true
      } catch (error) {
        console.error(`[CacheHelper] 内存缓存删除失败 ${key}:`, error)
      }

      return redisSuccess || memorySuccess
    } catch (error) {
      console.error(`[CacheHelper] 删除缓存失败 ${key}:`, error)
      return false
    }
  }

  /**
   * 批量删除缓存（支持模式匹配）
   */
  static async deletePattern(pattern: string): Promise<boolean> {
    try {
      let redisSuccess = false
      let memorySuccess = false

      // 从Redis批量删除
      if (isRedisReady()) {
        redisSuccess =
          (await executeRedisCommand(
            async () => {
              const client = (await import('./redis')).getRedisClient()
              if (!client) return false
              const keys = await client.keys(pattern)
              if (keys.length > 0) {
                await client.del(...keys)
              }
              return true
            },
            async () => false
          )) || false
      }

      // 从内存缓存批量删除
      try {
        await cacheService.deleteCachePattern(pattern)
        memorySuccess = true
      } catch (error) {
        console.error(`[CacheHelper] 内存缓存批量删除失败 ${pattern}:`, error)
      }

      return redisSuccess || memorySuccess
    } catch (error) {
      console.error(`[CacheHelper] 批量删除缓存失败 ${pattern}:`, error)
      return false
    }
  }

  /**
   * 获取或设置缓存（永久缓存）
   */
  static async getOrSet<T>(key: string, loader: () => Promise<T>): Promise<T | null> {
    try {
      // 先尝试获取缓存
      const cached = await this.get<T>(key)
      if (cached !== null) {
        return cached
      }

      // 缓存未命中，执行loader函数
      const data = await loader()
      if (data !== null && data !== undefined) {
        // 异步设置缓存（永久缓存），不等待结果
        this.set(key, data).catch((error) => {
          console.error(`[CacheHelper] 异步设置缓存失败 ${key}:`, error)
        })
      }

      return data
    } catch (error) {
      console.error(`[CacheHelper] getOrSet操作失败 ${key}:`, error)
      return null
    }
  }

  /**
   * 构建缓存键
   */
  static buildKey(prefix: string, ...parts: (string | number)[]): string {
    return prefix + parts.join(':')
  }

  /**
   * 检查缓存版本是否有效
   */
  static async isVersionValid(key: string, expectedVersion?: string): Promise<boolean> {
    if (!expectedVersion) return true

    try {
      if (isRedisReady()) {
        const storedVersion = await executeRedisCommand(
          async () => {
            const client = (await import('./redis')).getRedisClient()
            if (!client) return null
            return await client.get(`${key}:version`)
          },
          async () => null
        )
        return storedVersion === expectedVersion
      } else {
        const cached = await cacheService.getCache(key)
        return cached?.version === expectedVersion
      }
    } catch (error) {
      console.error('版本检查失败:', error)
      return false
    }
  }

  /**
   * 批量失效相关缓存
   */
  static async invalidateRelated(patterns: string[]): Promise<void> {
    try {
      for (const pattern of patterns) {
        await this.deletePattern(pattern)
        console.log(`[CacheHelper] 已失效缓存模式: ${pattern}`)
      }
    } catch (error) {
      console.error('[CacheHelper] 批量失效缓存失败:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  static async getStats(): Promise<{
    redis: { enabled: boolean; keyCount?: number }
    memory: { keyCount: number; memoryUsage: number }
    versions: { count: number }
  }> {
    const stats = {
      redis: { enabled: false as boolean, keyCount: undefined as number | undefined },
      memory: { keyCount: 0, memoryUsage: 0 },
      versions: { count: this.cacheVersions.size }
    }

    // Redis统计
    if (isRedisReady()) {
      stats.redis.enabled = true
      try {
        const keyCount = await executeRedisCommand(async (client) => {
          const keys = await client.keys('*')
          return keys.length
        }, 0)
        stats.redis.keyCount = keyCount
      } catch (error) {
        console.error('获取Redis统计失败:', error)
      }
    }

    // 内存缓存统计
    try {
      const memoryStats = await cacheService.getCacheStats()
      stats.memory.keyCount = memoryStats.keyCount || 0
      stats.memory.memoryUsage = JSON.stringify(memoryStats).length
    } catch (error) {
      console.error('[CacheHelper] 获取内存缓存统计失败:', error)
    }

    return stats
  }

  private static generateVersion(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9)
  }
}

// 便捷函数导出
export const cache = {
  get: CacheHelper.get.bind(CacheHelper),
  set: CacheHelper.set.bind(CacheHelper),
  delete: CacheHelper.delete.bind(CacheHelper),
  deletePattern: CacheHelper.deletePattern.bind(CacheHelper),
  getOrSet: CacheHelper.getOrSet.bind(CacheHelper),
  buildKey: CacheHelper.buildKey.bind(CacheHelper),
  getStats: CacheHelper.getStats.bind(CacheHelper)
}

// 特定业务的缓存辅助函数（永久缓存）
export const systemCache = {
  getConfig: () => cache.get(cache.buildKey(CACHE_PREFIXES.SYSTEM, 'config')),
  setConfig: (config: any) => cache.set(cache.buildKey(CACHE_PREFIXES.SYSTEM, 'config'), config),
  clearConfig: () => cache.delete(cache.buildKey(CACHE_PREFIXES.SYSTEM, 'config'))
}

/**
 * 认证缓存模块
 *
 * Version Tag 方案替代 Redis KEYS：
 * - setAuth 写入时附加 _v（当前全局版本号）
 * - getAuth 读取时比对 _v，不一致则视为缓存未命中
 * - clearAllAuth 通过 INCR 全局版本号（O(1)）失效所有认证缓存
 *
 * 使用位置：server/api/admin/system-settings/index.post.ts 保存系统设置后调用
 * userCache.clearAllAuth()，确保 forcePasswordChangeOnFirstLogin 立即生效。
 */
export const userCache = {
  getAuth: async (userId: string) => {
    const data = await cache.get<any>(`auth:user:${userId}`)
    if (!data) return null
    // Version Tag 校验：若 _v 与全局版本号不一致，视为缓存已失效
    if (data._v !== undefined) {
      const currentVersion = await getGlobalVersion()
      if (data._v !== currentVersion) return null
    }
    return data
  },
  setAuth: async (userId: string, authData: any) => {
    // 写入时附加当前全局版本号（优先使用内存缓存），用于 getAuth 的版本校验
    const version = await getGlobalVersion()
    return cache.set(`auth:user:${userId}`, { ...authData, _v: version })
  },
  clearAuth: (userId: string) => cache.delete(`auth:user:${userId}`),
  /**
   * 失效全部认证缓存
   *
   * 采用 Version Tag 方案（O(1) INCR），替代 Redis KEYS（O(N) blocking）。
   *
   * 注意：旧版本缓存数据不会立即被清理，而是在下次 getAuth 读取时
   * 因 _v 不匹配而被淘汰。无需担心内存占用，旧数据在下次 setAuth 时覆盖。
   */
  clearAllAuth: async () => {
    // Version Tag: INCR 全局版本号使所有缓存失效，避免 KEYS 阻塞
    if (isRedisReady()) {
      const newVersion = await executeRedisCommand(
        async () => {
          const client = (await import('./redis')).getRedisClient()
          if (!client) return null
          const version = await client.incr(AUTH_GLOBAL_VERSION_KEY)
          console.log('[CacheHelper] 全局认证缓存已通过 Version Tag 失效')
          return version
        },
        async () => null
      )
      // 立即更新内存缓存，跳过 TTL 等待，确保后续 getAuth/setAuth 使用新版本号
      if (newVersion !== null && newVersion !== undefined) {
        cachedGlobalVersion = String(newVersion)
        cachedGlobalVersionTime = Date.now()
      }
    } else {
      // Redis 不可用时，清除内存缓存并回退到清理认证数据
      cachedGlobalVersion = null
      cachedGlobalVersionTime = 0
      await cache.deletePattern('auth:user:*')
    }
    return true
  }
}

export const scheduleCache = {
  getPublic: () => cache.get(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'public')),
  setPublic: (schedules: any) =>
    cache.set(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'public'), schedules),
  getSemester: (semesterId: string) =>
    cache.get(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'semester', semesterId)),
  setSemester: (semesterId: string, schedules: any) =>
    cache.set(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'semester', semesterId), schedules),
  clearAll: () => cache.deletePattern(cache.buildKey(CACHE_PREFIXES.SCHEDULE, '*')),

  // 智能缓存失效 - 数据变更时自动更新相关缓存
  async invalidateOnScheduleChange(
    changeType: 'public' | 'semester' | 'all',
    semesterId?: string
  ): Promise<void> {
    try {
      console.log(`[ScheduleCache] 排期数据变更，失效缓存类型: ${changeType}`)

      switch (changeType) {
        case 'public':
          // 公共排期变更，清除公共排期缓存
          await cache.delete(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'public'))
          console.log('[ScheduleCache] 已清除公共排期缓存')
          break

        case 'semester':
          // 学期排期变更，清除特定学期缓存
          if (semesterId) {
            await cache.delete(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'semester', semesterId))
            console.log(`[ScheduleCache] 已清除学期 ${semesterId} 排期缓存`)
          }
          break

        case 'all':
          // 全部排期变更，清除所有排期缓存
          await cache.deletePattern(cache.buildKey(CACHE_PREFIXES.SCHEDULE, '*'))
          console.log('[ScheduleCache] 已清除所有排期缓存')
          break
      }

      // 触发相关统计缓存失效
      await cache.deletePattern(cache.buildKey(CACHE_PREFIXES.STATS, 'schedule', '*'))
      console.log('[ScheduleCache] 已清除相关统计缓存')
    } catch (error) {
      console.error('[ScheduleCache] 缓存失效操作失败:', error)
    }
  },

  // 预热缓存 - 在数据变更后主动加载新数据到缓存
  async warmupCache(
    loader: {
      loadPublic?: () => Promise<any>
      loadSemester?: (semesterId: string) => Promise<any>
    },
    semesterId?: string
  ): Promise<void> {
    try {
      console.log('[ScheduleCache] 开始预热缓存')

      // 预热公共排期缓存
      if (loader.loadPublic) {
        const publicSchedules = await loader.loadPublic()
        if (publicSchedules) {
          await this.setPublic(publicSchedules)
          console.log('[ScheduleCache] 公共排期缓存预热完成')
        }
      }

      // 预热学期排期缓存
      if (loader.loadSemester && semesterId) {
        const semesterSchedules = await loader.loadSemester(semesterId)
        if (semesterSchedules) {
          await this.setSemester(semesterId, semesterSchedules)
          console.log(`[ScheduleCache] 学期 ${semesterId} 排期缓存预热完成`)
        }
      }
    } catch (error) {
      console.error('[ScheduleCache] 缓存预热失败:', error)
    }
  }
}
