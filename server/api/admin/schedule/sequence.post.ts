import { db, users, songs, notifications, notificationSettings, schedules, votes, playTimes, semesters, songBlacklists, systemSettings, roles, eq, and, or, count, exists, desc, asc } from '~/drizzle/db'
import { CacheService } from '~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  // 验证用户认证和权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '需要歌曲管理员及以上权限'
    })
  }
  
  try {
    const body = await readBody(event)
    const { schedules } = body
    
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少排期数据'
      })
    }
    
    // 批量更新排期顺序
    const results = await Promise.all(
      schedules.map(async (item) => {
        return db.update(schedules)
          .set({ sequence: item.sequence })
          .where(eq(schedules.id, Number(item.id)))
      })
    )

    // 清除排期相关缓存
    try {
      const cacheService = CacheService.getInstance()
      await cacheService.clearSchedulesCache()
      await cacheService.clearStatsCache()
      console.log('[Cache] 排期缓存和统计缓存已清除（更新排期顺序）')
    } catch (error) {
      console.error('清除排期缓存失败:', error)
    }

    return {
      success: true,
      count: results.length
    }
  } catch (error: any) {
    console.error('更新排期顺序失败:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '更新排期顺序失败'
    })
  }
})