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

export const userCache = {
  getAuth: (userId: string) => cache.get(cache.buildKey(CACHE_PREFIXES.AUTH, userId)),
  setAuth: (userId: string, authData: any) =>
    cache.set(cache.buildKey(CACHE_PREFIXES.AUTH, userId), authData),
  clearAuth: (userId: string) => cache.delete(cache.buildKey(CACHE_PREFIXES.AUTH, userId)),
  clearAllAuth: () => cache.deletePattern(cache.buildKey(CACHE_PREFIXES.AUTH, '*'))
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
