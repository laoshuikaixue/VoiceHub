import { executeRedisCommand, isRedisReady } from '../utils/redis'
import { prisma } from '../models/schema'
import { executeWithPool } from '../utils/db-pool'

// 缓存键前缀
const CACHE_PREFIXES = {
  SONGS: 'songs',
  SCHEDULES: 'schedules',
  SONG_COUNT: 'song_count',
  USER_VOTES: 'user_votes',
  SCHEDULE_BY_DATE: 'schedule_date',
  EMPTY_RESULT: 'empty' // 空结果缓存，防止缓存穿透
} as const

// 缓存TTL配置（秒）
const CACHE_TTL = {
  SONGS_LIST: 300, // 5分钟
  SCHEDULES: 600, // 10分钟
  SONG_COUNT: 180, // 3分钟
  USER_VOTES: 120, // 2分钟
  EMPTY_RESULT: 60, // 1分钟（空结果缓存时间较短）
  SYSTEM_SETTINGS: 3600, // 60分钟
  RANDOM_OFFSET: 60, // 随机偏移量，防止缓存雪崩
  LOCK_TIMEOUT: 30, // 分布式锁超时时间
  REFRESH_AHEAD: 60 // 提前刷新时间（秒）
} as const

// 缓存刷新锁，防止缓存击穿
const refreshLocks = new Map<string, Promise<any>>()

// 缓存服务类
class CacheService {
  // 单例实例
  private static instance: CacheService | null = null

  // 获取单例实例
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }
  // 生成缓存键
  private generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `voicehub:${prefix}:${parts.join(':')}`
  }

  // 获取带随机偏移的TTL，防止缓存雪崩
  private getRandomTTL(baseTTL: number): number {
    const offset = Math.floor(Math.random() * CACHE_TTL.RANDOM_OFFSET)
    return baseTTL + offset
  }

  // 序列化数据
  private serialize(data: any): string {
    return JSON.stringify(data)
  }

  // 反序列化数据
  private deserialize<T>(data: string | null): T | null {
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch (error) {
      console.error('[Cache] 反序列化失败:', error)
      return null
    }
  }

  // 设置缓存
  private async setCache(key: string, data: any, ttl: number): Promise<boolean> {
    if (!isRedisReady()) return false

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return false
      
      await client.setEx(key, this.getRandomTTL(ttl), this.serialize(data))
      return true
    }) || false
  }

  // 获取缓存
  private async getCache<T>(key: string): Promise<T | null> {
    if (!isRedisReady()) return null

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return null
      
      const data = await client.get(key)
      return this.deserialize<T>(data)
    }) || null
  }

  // 删除缓存
  private async deleteCache(key: string): Promise<boolean> {
    if (!isRedisReady()) return false

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return false
      
      await client.del(key)
      return true
    }) || false
  }

  // 批量删除缓存（按模式）
  private async deleteCachePattern(pattern: string): Promise<boolean> {
    if (!isRedisReady()) return false

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return false
      
      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(keys)
      }
      return true
    }) || false
  }

  // 获取分布式锁
  private async acquireLock(lockKey: string, timeout: number = CACHE_TTL.LOCK_TIMEOUT): Promise<boolean> {
    if (!isRedisReady()) return false

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return false
      
      const result = await client.set(lockKey, '1', {
        EX: timeout,
        NX: true
      })
      return result === 'OK'
    }) || false
  }

  // 释放分布式锁
  private async releaseLock(lockKey: string): Promise<void> {
    if (!isRedisReady()) return

    await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return
      
      await client.del(lockKey)
    })
  }

  // 防缓存击穿的数据获取
  private async getWithLock<T>(
    cacheKey: string,
    lockKey: string,
    dataLoader: () => Promise<T>,
    ttl: number
  ): Promise<T | null> {
    // 先尝试从缓存获取
    const cached = await this.getCache<T>(cacheKey)
    if (cached !== null) {
      return cached
    }

    // 检查是否有正在进行的刷新操作
    if (refreshLocks.has(lockKey)) {
      try {
        return await refreshLocks.get(lockKey)!
      } catch (error) {
        console.error(`[Cache] 等待刷新锁失败: ${lockKey}`, error)
        return null
      }
    }

    // 尝试获取分布式锁
    const lockAcquired = await this.acquireLock(lockKey)
    if (!lockAcquired) {
      // 未获取到锁，等待一段时间后重试获取缓存
      await new Promise(resolve => setTimeout(resolve, 100))
      return await this.getCache<T>(cacheKey)
    }

    // 获取到锁，开始数据加载
    const refreshPromise = (async () => {
      try {
        const data = await dataLoader()
        if (data !== null) {
          await this.setCache(cacheKey, data, ttl)
        }
        return data
      } finally {
        await this.releaseLock(lockKey)
        refreshLocks.delete(lockKey)
      }
    })()

    refreshLocks.set(lockKey, refreshPromise)
    return await refreshPromise
  }

  // ==================== 歌曲相关缓存 ====================

  // 获取歌曲列表缓存
  async getSongList(semester?: string, userId?: number): Promise<any[] | null> {
    const key = this.generateKey(
      CACHE_PREFIXES.SONGS, 
      'list', 
      semester || 'all',
      userId ? `user_${userId}` : 'public'
    )
    
    const cached = await this.getCache<any[]>(key)
    if (cached) {
      console.log(`[Cache] 歌曲列表缓存命中: ${key}`)
      // 检查是否是空结果缓存
      if (Array.isArray(cached) && cached.length === 1 && cached[0]?.__empty) {
        return []
      }
      return cached
    }
    
    return null
  }

  // 设置歌曲列表缓存
  async setSongList(songs: any[], semester?: string, userId?: number): Promise<void> {
    const key = this.generateKey(
      CACHE_PREFIXES.SONGS, 
      'list', 
      semester || 'all',
      userId ? `user_${userId}` : 'public'
    )
    
    // 如果是空结果，设置特殊标记防止缓存穿透
    const cacheData = songs.length === 0 ? [{ __empty: true }] : songs
    const ttl = songs.length === 0 ? CACHE_TTL.EMPTY_RESULT : CACHE_TTL.SONGS_LIST
    
    await this.setCache(key, cacheData, ttl)
    console.log(`[Cache] 歌曲列表已缓存: ${key}, 数量: ${songs.length}`)
  }

  // 获取歌曲数量缓存
  async getSongCount(semester?: string): Promise<number | null> {
    const key = this.generateKey(CACHE_PREFIXES.SONG_COUNT, semester || 'all')
    return await this.getCache<number>(key)
  }

  // 设置歌曲数量缓存
  async setSongCount(count: number, semester?: string): Promise<void> {
    const key = this.generateKey(CACHE_PREFIXES.SONG_COUNT, semester || 'all')
    await this.setCache(key, count, CACHE_TTL.SONG_COUNT)
  }

  // 获取用户投票状态缓存
  async getUserVotes(userId: number, semester?: string): Promise<number[] | null> {
    const key = this.generateKey(CACHE_PREFIXES.USER_VOTES, userId, semester || 'all')
    return await this.getCache<number[]>(key)
  }

  // 设置用户投票状态缓存
  async setUserVotes(userId: number, songIds: number[], semester?: string): Promise<void> {
    const key = this.generateKey(CACHE_PREFIXES.USER_VOTES, userId, semester || 'all')
    await this.setCache(key, songIds, CACHE_TTL.USER_VOTES)
  }

  // 清除歌曲相关缓存
  async clearSongsCache(semester?: string): Promise<void> {
    const patterns = [
      this.generateKey(CACHE_PREFIXES.SONGS, '*'),
      this.generateKey(CACHE_PREFIXES.SONG_COUNT, '*'),
      this.generateKey(CACHE_PREFIXES.USER_VOTES, '*')
    ]
    
    for (const pattern of patterns) {
      await this.deleteCachePattern(pattern)
    }
    
    console.log(`[Cache] 歌曲相关缓存已清除${semester ? ` (学期: ${semester})` : ''}`)
  }

  // ==================== 排期相关缓存 ====================

  // 获取排期列表缓存
  async getSchedulesList(startDate?: Date, endDate?: Date): Promise<any[] | null> {
    const key = this.generateKey(
      CACHE_PREFIXES.SCHEDULES,
      'list',
      startDate?.toISOString().split('T')[0] || 'all',
      endDate?.toISOString().split('T')[0] || 'all'
    )
    
    const cached = await this.getCache<any[]>(key)
    if (cached) {
      console.log(`[Cache] 排期列表缓存命中: ${key}`)
      // 检查是否是空结果缓存
      if (Array.isArray(cached) && cached.length === 1 && cached[0]?.__empty) {
        return []
      }
      return cached
    }
    
    return null
  }

  // 设置排期列表缓存
  async setSchedulesList(schedules: any[], startDate?: Date, endDate?: Date): Promise<void> {
    const key = this.generateKey(
      CACHE_PREFIXES.SCHEDULES,
      'list',
      startDate?.toISOString().split('T')[0] || 'all',
      endDate?.toISOString().split('T')[0] || 'all'
    )
    
    // 如果是空结果，设置特殊标记防止缓存穿透
    const cacheData = schedules.length === 0 ? [{ __empty: true }] : schedules
    const ttl = schedules.length === 0 ? CACHE_TTL.EMPTY_RESULT : CACHE_TTL.SCHEDULES
    
    await this.setCache(key, cacheData, ttl)
    console.log(`[Cache] 排期列表已缓存: ${key}, 数量: ${schedules.length}`)
  }

  // 获取特定日期的排期缓存
  async getSchedulesByDate(date: Date): Promise<any[] | null> {
    const dateStr = date.toISOString().split('T')[0]
    const key = this.generateKey(CACHE_PREFIXES.SCHEDULE_BY_DATE, dateStr)
    
    const cached = await this.getCache<any[]>(key)
    if (cached) {
      console.log(`[Cache] 日期排期缓存命中: ${key}`)
      if (Array.isArray(cached) && cached.length === 1 && cached[0]?.__empty) {
        return []
      }
      return cached
    }
    
    return null
  }

  // 设置特定日期的排期缓存
  async setSchedulesByDate(schedules: any[], date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0]
    const key = this.generateKey(CACHE_PREFIXES.SCHEDULE_BY_DATE, dateStr)
    
    const cacheData = schedules.length === 0 ? [{ __empty: true }] : schedules
    const ttl = schedules.length === 0 ? CACHE_TTL.EMPTY_RESULT : CACHE_TTL.SCHEDULES
    
    await this.setCache(key, cacheData, ttl)
    console.log(`[Cache] 日期排期已缓存: ${key}, 数量: ${schedules.length}`)
  }

  // 清除排期相关缓存
  async clearSchedulesCache(date?: Date): Promise<void> {
    if (date) {
      // 清除特定日期的缓存
      const dateStr = date.toISOString().split('T')[0]
      const key = this.generateKey(CACHE_PREFIXES.SCHEDULE_BY_DATE, dateStr)
      await this.deleteCache(key)
      console.log(`[Cache] 日期排期缓存已清除: ${dateStr}`)
    } else {
      // 清除所有排期缓存
      const patterns = [
        this.generateKey(CACHE_PREFIXES.SCHEDULES, '*'),
        this.generateKey(CACHE_PREFIXES.SCHEDULE_BY_DATE, '*')
      ]
      
      for (const pattern of patterns) {
        await this.deleteCachePattern(pattern)
      }
      
      console.log('[Cache] 所有排期缓存已清除')
    }
  }

  // ==================== 系统设置相关缓存 ====================

  // 获取系统设置缓存
  async getSystemSettings(): Promise<any | null> {
    const key = this.generateKey('system', 'settings')
    return await this.getCache<any>(key)
  }

  // 设置系统设置缓存
  async setSystemSettings(settings: any): Promise<void> {
    const key = this.generateKey('system', 'settings')
    await this.setCache(key, settings, CACHE_TTL.SYSTEM_SETTINGS)
    console.log(`[Cache] 系统设置已缓存: ${key}`)
  }

  // 清除系统设置缓存
  async clearSystemSettingsCache(): Promise<void> {
    const pattern = this.generateKey('system', '*')
    await this.deleteCachePattern(pattern)
    console.log('[Cache] 系统设置缓存已清除')
  }

  // ==================== 播放时间相关缓存 ====================

  // 获取播放时间列表缓存
  async getPlayTimes(): Promise<any[] | null> {
    const key = this.generateKey('playtimes', 'list')
    
    const cached = await this.getCache<any[]>(key)
    if (cached) {
      console.log(`[Cache] 播放时间列表缓存命中: ${key}`)
      // 检查是否是空结果缓存
      if (Array.isArray(cached) && cached.length === 1 && cached[0]?.__empty) {
        return []
      }
      return cached
    }
    
    return null
  }

  // 设置播放时间列表缓存
  async setPlayTimes(playTimes: any[]): Promise<void> {
    const key = this.generateKey('playtimes', 'list')
    
    // 如果是空结果，设置特殊标记防止缓存穿透
    const cacheData = playTimes.length === 0 ? [{ __empty: true }] : playTimes
    const ttl = playTimes.length === 0 ? CACHE_TTL.EMPTY_RESULT : CACHE_TTL.SYSTEM_SETTINGS
    
    await this.setCache(key, cacheData, ttl)
    console.log(`[Cache] 播放时间列表已缓存: ${key}, 数量: ${playTimes.length}`)
  }

  // 清除播放时间相关缓存
  async clearPlayTimesCache(): Promise<void> {
    const pattern = this.generateKey('playtimes', '*')
    await this.deleteCachePattern(pattern)
    console.log('[Cache] 播放时间缓存已清除')
  }

  // ==================== 缓存预热 ====================

  // 预热歌曲缓存
  async warmupSongsCache(semester?: string): Promise<void> {
    if (!isRedisReady()) return
    
    console.log(`[Cache] 开始预热歌曲缓存${semester ? ` (学期: ${semester})` : ''}`)
    
    try {
      // 预热歌曲列表
      const songs = await executeWithPool(async () => {
        const whereCondition: any = {}
        if (semester) {
          whereCondition.semester = semester
        }
        
        return await prisma.song.findMany({
          where: whereCondition,
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                grade: true,
                class: true
              }
            },
            votes: {
              select: {
                id: true,
                userId: true
              }
            },
            _count: {
              select: {
                votes: true
              }
            },
            schedules: {
              select: {
                id: true
              }
            },
            preferredPlayTime: true
          },
          orderBy: [
            {
              votes: {
                _count: 'desc'
              }
            },
            {
              createdAt: 'asc'
            }
          ]
        })
      }, 'warmupSongsCache')
      
      if (songs) {
        await this.setSongList(songs, semester)
        await this.setSongCount(songs.length, semester)
      }
      
      console.log(`[Cache] 歌曲缓存预热完成，缓存了 ${songs?.length || 0} 首歌曲`)
    } catch (error) {
      console.error('[Cache] 歌曲缓存预热失败:', error)
    }
  }

  // 预热排期缓存
  async warmupSchedulesCache(): Promise<void> {
    if (!isRedisReady()) return
    
    console.log('[Cache] 开始预热排期缓存')
    
    try {
      // 预热未来7天的排期
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 7)
      
      const schedules = await executeWithPool(async () => {
        return await prisma.schedule.findMany({
          where: {
            playDate: {
              gte: today,
              lte: endDate
            }
          },
          include: {
            song: {
              include: {
                requester: {
                  select: {
                    id: true,
                    name: true,
                    grade: true,
                    class: true
                  }
                }
              }
            },
            playTime: true
          },
          orderBy: [
            { playDate: 'asc' },
            { sequence: 'asc' }
          ]
        })
      }, 'warmupSchedulesCache')
      
      if (schedules) {
        await this.setSchedulesList(schedules, today, endDate)
        
        // 按日期分组缓存
        const schedulesByDate = new Map<string, any[]>()
        schedules.forEach(schedule => {
          const dateStr = schedule.playDate.toISOString().split('T')[0]
          if (!schedulesByDate.has(dateStr)) {
            schedulesByDate.set(dateStr, [])
          }
          schedulesByDate.get(dateStr)!.push(schedule)
        })
        
        // 缓存每日排期
        for (const [dateStr, daySchedules] of schedulesByDate) {
          await this.setSchedulesByDate(daySchedules, new Date(dateStr))
        }
      }
      
      console.log(`[Cache] 排期缓存预热完成，缓存了 ${schedules?.length || 0} 个排期`)
    } catch (error) {
      console.error('[Cache] 排期缓存预热失败:', error)
    }
  }

  // 预热系统设置缓存
  async warmUpSystemSettings(): Promise<void> {
    try {
      const { prisma } = await import('../models/schema')
      let settings = await prisma.systemSettings.findFirst()
      
      if (!settings) {
        // 如果不存在，创建默认设置
        settings = await prisma.systemSettings.create({
          data: {
            enablePlayTimeSelection: false,
            siteTitle: 'VoiceHub',
            siteLogoUrl: '/favicon.ico',
            schoolLogoHomeUrl: null,
            schoolLogoPrintUrl: null,
            siteDescription: '校园广播站点歌系统 - 让你的声音被听见',
            submissionGuidelines: '请遵守校园规定，提交健康向上的歌曲。',
            icpNumber: null,
            enableSubmissionLimit: false,
            dailySubmissionLimit: null,
            weeklySubmissionLimit: null,
            showBlacklistKeywords: false
          }
        })
      }
      
      await this.setSystemSettings(settings)
      console.log('[Cache] 系统设置缓存预热完成')
    } catch (error) {
      console.error('[Cache] 系统设置缓存预热失败:', error)
    }
  }

  // ==================== 统计数据缓存 ====================

  // 获取管理员统计数据
  async getAdminStats(semester?: string): Promise<any> {
    if (!isRedisReady()) return null

    const key = semester ? `admin_stats:${semester}` : 'admin_stats:all'
    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return null
      
      const data = await client.get(key)
      return data ? JSON.parse(data) : null
    })
  }

  // 设置管理员统计数据缓存
  async setAdminStats(data: any, semester?: string): Promise<void> {
    if (!isRedisReady()) return

    const key = semester ? `admin_stats:${semester}` : 'admin_stats:all'
    await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return
      
      // 统计数据缓存5分钟
      await client.setEx(key, 300, JSON.stringify(data))
    })
  }

  // 获取实时统计数据
  async getRealtimeStats(): Promise<any> {
    if (!isRedisReady()) return null

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return null
      
      const data = await client.get('realtime_stats')
      return data ? JSON.parse(data) : null
    })
  }

  // 设置实时统计数据缓存
  async setRealtimeStats(data: any): Promise<void> {
    if (!isRedisReady()) return

    await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return
      
      // 实时统计数据缓存2分钟
      await client.setEx('realtime_stats', 120, JSON.stringify(data))
    })
  }

  // 获取活跃用户统计
  async getActiveUsersStats(semester?: string, limit?: number): Promise<any> {
    if (!isRedisReady()) return null

    const key = `active_users:${semester || 'all'}:${limit || 10}`
    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return null
      
      const data = await client.get(key)
      return data ? JSON.parse(data) : null
    })
  }

  // 设置活跃用户统计缓存
  async setActiveUsersStats(data: any, semester?: string, limit?: number): Promise<void> {
    if (!isRedisReady()) return

    const key = `active_users:${semester || 'all'}:${limit || 10}`
    await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return
      
      // 活跃用户统计缓存10分钟
      await client.setEx(key, 600, JSON.stringify(data))
    })
  }

  // 清除所有统计缓存
  async clearStatsCache(): Promise<void> {
    if (!isRedisReady()) return

    await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return
      
      const keys = await client.keys('admin_stats:*')
      const realtimeKeys = await client.keys('realtime_stats')
      const activeUserKeys = await client.keys('active_users:*')
      
      const allKeys = [...keys, ...realtimeKeys, ...activeUserKeys]
      if (allKeys.length > 0) {
        await client.del(allKeys)
        console.log(`[Cache] 已清除 ${allKeys.length} 个统计缓存键`)
      }
    })
  }

  // ==================== 缓存统计 ====================

  // 获取缓存统计信息
  async getCacheStats(): Promise<any> {
    if (!isRedisReady()) {
      return {
        enabled: false,
        message: 'Redis未启用或不可用'
      }
    }

    return await executeRedisCommand(async () => {
      const client = (await import('../utils/redis')).getRedisClient()
      if (!client) return { enabled: false }
      
      const info = await client.info('memory')
      const keyCount = await client.dbSize()
      
      return {
        enabled: true,
        keyCount,
        memoryInfo: info,
        redisStats: (await import('../utils/redis')).getRedisStats()
      }
    }) || { enabled: false }
  }

  // 清除所有缓存
  async clearAllCache(): Promise<void> {
    await this.clearSongsCache()
    await this.clearSchedulesCache()
    await this.clearSystemSettingsCache()
    console.log('[Cache] 所有缓存已清除')
  }

  // ==================== 定期刷新机制 ====================

  // 启动定期刷新任务
  startPeriodicRefresh(): void {
    if (!isRedisReady()) {
      console.log('[Cache] Redis未启用，跳过定期刷新任务')
      return
    }

    console.log('[Cache] 启动定期刷新任务')
    
    // 每5分钟刷新歌曲缓存
    setInterval(async () => {
      try {
        await this.warmupSongsCache()
        console.log('[Cache] 定期歌曲缓存刷新完成')
      } catch (error) {
        console.error('[Cache] 定期歌曲缓存刷新失败:', error)
      }
    }, 5 * 60 * 1000)

    // 每10分钟刷新排期缓存
    setInterval(async () => {
      try {
        await this.warmupSchedulesCache()
        console.log('[Cache] 定期排期缓存刷新完成')
      } catch (error) {
        console.error('[Cache] 定期排期缓存刷新失败:', error)
      }
    }, 10 * 60 * 1000)

    // 每30分钟刷新系统设置缓存
    setInterval(async () => {
      try {
        await this.warmUpSystemSettings()
        console.log('[Cache] 定期系统设置缓存刷新完成')
      } catch (error) {
        console.error('[Cache] 定期系统设置缓存刷新失败:', error)
      }
    }, 30 * 60 * 1000)

    // 每小时清理过期的刷新锁
    setInterval(() => {
      const now = Date.now()
      for (const [key, promise] of refreshLocks.entries()) {
        // 检查Promise状态，如果已完成则清理
        Promise.race([promise, Promise.resolve('timeout')])
          .then(() => {
            if (refreshLocks.has(key)) {
              refreshLocks.delete(key)
            }
          })
          .catch(() => {
            refreshLocks.delete(key)
          })
      }
      console.log(`[Cache] 清理刷新锁，当前锁数量: ${refreshLocks.size}`)
    }, 60 * 60 * 1000)
  }

  // 停止定期刷新任务（用于优雅关闭）
  stopPeriodicRefresh(): void {
    // 清理所有刷新锁
    refreshLocks.clear()
    console.log('[Cache] 定期刷新任务已停止')
  }

  // 初始化缓存系统
  async initialize(): Promise<void> {
    if (!isRedisReady()) {
      console.log('[Cache] Redis未启用，缓存系统初始化跳过')
      return
    }

    console.log('[Cache] 初始化缓存系统')
    
    try {
      // 预热核心缓存
      await Promise.all([
        this.warmupSongsCache(),
        this.warmupSchedulesCache(),
        this.warmUpSystemSettings()
      ])
      
      // 启动定期刷新
      this.startPeriodicRefresh()
      
      console.log('[Cache] 缓存系统初始化完成')
    } catch (error) {
      console.error('[Cache] 缓存系统初始化失败:', error)
    }
  }
}

// 创建全局缓存服务实例
const cacheService = new CacheService()

// 在服务启动时初始化缓存系统
if (process.env.NODE_ENV !== 'test') {
  // 延迟初始化，确保Redis连接已建立
  setTimeout(() => {
    cacheService.initialize().catch(error => {
      console.error('[Cache] 缓存系统初始化失败:', error)
    })
  }, 1000)
}

export { cacheService, CacheService }
export default cacheService