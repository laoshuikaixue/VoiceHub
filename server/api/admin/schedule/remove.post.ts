import { db, users, songs, notifications, notificationSettings, schedules, votes, playTimes, semesters, songBlacklists, systemSettings, roles, eq, and, or, count, exists, desc, asc } from '~/drizzle/db'
import { CacheService } from '~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '需要歌曲管理员及以上权限'
    })
  }
  
  try {
    const body = await readBody(event)
    const { scheduleId } = body
    
    if (!scheduleId) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少排期ID'
      })
    }
    
    const scheduleIdNumber = Number(scheduleId)
    
    console.log(`准备删除排期 ID=${scheduleIdNumber}`)
    
    // 先检查排期是否存在
    const existingSchedule = await db.select({
      id: schedules.id,
      songTitle: songs.title,
      songArtist: songs.artist
    })
    .from(schedules)
    .leftJoin(songs, eq(schedules.songId, songs.id))
    .where(eq(schedules.id, scheduleIdNumber))
    .limit(1)
    .then(rows => rows[0])
    
    if (!existingSchedule) {
      console.log(`排期不存在 ID=${scheduleIdNumber}`)
      return {
        success: false,
        message: '排期不存在或已被删除'
      }
    }
    
    console.log(`找到排期 ID=${scheduleIdNumber}, 歌曲=${existingSchedule.songTitle || '未知歌曲'}`)
    
    // 删除排期
    const deletedSchedule = await db.delete(schedules)
      .where(eq(schedules.id, scheduleIdNumber))
      .returning()
    
    console.log(`成功删除排期 ID=${scheduleIdNumber}`)
    
    // 清除相关缓存
    const { cache } = await import('~/server/utils/cache-helpers')
    await cache.deletePattern('schedules:*')
    await cache.deletePattern('stats:*')
    console.log('[Cache] 排期缓存和统计缓存已清除（删除排期）')
    
    return {
      success: true,
      schedule: deletedSchedule
    }
  } catch (error: any) {
    console.error('移除排期失败:', error)
    
    // 处理数据库特定错误
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      return {
        success: false,
        message: '排期不存在或已被删除'
      }
    }
    
    // 确保返回一个成功=false的响应，而不是抛出错误
    return {
      success: false,
      message: error.message || '移除排期失败',
      error: error.code || 'UNKNOWN_ERROR'
    }
  }
})