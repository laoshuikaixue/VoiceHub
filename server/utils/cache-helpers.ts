import { isRedisReady, executeRedisCommand } from './redis'
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
  /**
   * 获取缓存数据，优先从Redis获取，fallback到CacheService
   */
  static async get<T>(key: string, fallbackToMemory = true): Promise<T | null> {
    try {
      // 优先尝试Redis
      if (isRedisReady()) {
        const result = await executeRedisCommand(
          async (client) => {
            const data = await client.get(key)
            return data ? JSON.parse(data) : null
          },
          null
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
  static async set<T>(key: string, value: T): Promise<boolean> {
    try {
      let redisSuccess = false
      let memorySuccess = false
      
      // 尝试写入Redis（永久缓存）
      if (isRedisReady()) {
        redisSuccess = await executeRedisCommand(
          async (client) => {
            await client.set(key, JSON.stringify(value))
            return true
          },
          false
        )
      }
      
      // 写入内存缓存（永久缓存）
      try {
        await cacheService.setCache(key, value)
        memorySuccess = true
      } catch (error) {
        console.error(`[CacheHelper] 内存缓存写入失败 ${key}:`, error)
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
        redisSuccess = await executeRedisCommand(
          async (client) => {
            await client.del(key)
            return true
          },
          false
        )
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
        redisSuccess = await executeRedisCommand(
          async (client) => {
            const keys = await client.keys(pattern)
            if (keys.length > 0) {
              await client.del(...keys)
            }
            return true
          },
          false
        )
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
  static async getOrSet<T>(
    key: string, 
    loader: () => Promise<T>
  ): Promise<T | null> {
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
        this.set(key, data).catch(error => {
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
   * 获取缓存统计信息
   */
  static async getStats(): Promise<{
    redis: { enabled: boolean; keys?: number; memory?: string }
    memory: { enabled: boolean; keys?: number; memory?: string }
  }> {
    const stats = {
      redis: { enabled: false as boolean, keys: undefined as number | undefined, memory: undefined as string | undefined },
      memory: { enabled: true, keys: undefined as number | undefined, memory: undefined as string | undefined }
    }
    
    // Redis统计
    if (isRedisReady()) {
      stats.redis.enabled = true
      try {
        const redisStats = await executeRedisCommand(
          async (client) => {
            const info = await client.info('memory')
            const dbsize = await client.dbsize()
            return { info, dbsize }
          },
          null
        )
        
        if (redisStats) {
          stats.redis.keys = redisStats.dbsize
          // 解析内存使用信息
          const memoryMatch = redisStats.info.match(/used_memory_human:([^\r\n]+)/)
          if (memoryMatch) {
            stats.redis.memory = memoryMatch[1].trim()
          }
        }
      } catch (error) {
        console.error('[CacheHelper] 获取Redis统计失败:', error)
      }
    }
    
    // 内存缓存统计
    try {
      const memoryStats = await cacheService.getCacheStats()
      stats.memory.keys = memoryStats.keyCount
      stats.memory.memory = memoryStats.memoryInfo
    } catch (error) {
      console.error('[CacheHelper] 获取内存缓存统计失败:', error)
    }
    
    return stats
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
  setAuth: (userId: string, authData: any) => cache.set(cache.buildKey(CACHE_PREFIXES.AUTH, userId), authData),
  clearAuth: (userId: string) => cache.delete(cache.buildKey(CACHE_PREFIXES.AUTH, userId)),
  clearAllAuth: () => cache.deletePattern(cache.buildKey(CACHE_PREFIXES.AUTH, '*'))
}

export const scheduleCache = {
  getPublic: () => cache.get(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'public')),
  setPublic: (schedules: any) => cache.set(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'public'), schedules),
  getSemester: (semesterId: string) => cache.get(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'semester', semesterId)),
  setSemester: (semesterId: string, schedules: any) => cache.set(cache.buildKey(CACHE_PREFIXES.SCHEDULE, 'semester', semesterId), schedules),
  clearAll: () => cache.deletePattern(cache.buildKey(CACHE_PREFIXES.SCHEDULE, '*'))
}