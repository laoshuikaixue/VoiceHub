import { db } from '~/drizzle/db'
import { songs, schedules, users, playTimes, votes } from '~/drizzle/schema'
import { eq, gte, lte, desc, asc, count, and } from 'drizzle-orm'
import { cacheService } from '~/server/services/cacheService'
import { createBeijingTime, getBeijingTimestamp } from '~/utils/timeUtils'
import { getClientIP } from '~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有歌曲管理员及以上权限才能保存排期草稿'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.songId || !body.playDate) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID和播放日期不能为空'
    })
  }
  
  try {
    // 检查歌曲是否存在
    const songResult = await db.select()
      .from(songs)
      .where(eq(songs.id, body.songId))
      .limit(1)
    
    const song = songResult[0]
    
    if (!song) {
      throw createError({
        statusCode: 404,
        message: '歌曲不存在'
      })
    }
    
    // 检查是否已经为该歌曲创建过排期或草稿，如果有则删除旧的
    const existingScheduleResult = await db.select()
      .from(schedules)
      .where(eq(schedules.songId, body.songId))
      .limit(1)
    
    const existingSchedule = existingScheduleResult[0]
    if (existingSchedule) {
      // 删除现有排期或草稿
      await db.delete(schedules)
        .where(eq(schedules.id, existingSchedule.id))
    }
    
    // 获取序号，如果未提供则查找当天最大序号+1
    let sequence = body.sequence || 1
    
    if (!body.sequence) {
      // 解析输入的日期字符串
      const inputDateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
      
      // 创建当天的开始和结束时间
      const startOfDay = new Date(inputDateStr + 'T00:00:00.000Z')
      const endOfDay = new Date(inputDateStr + 'T23:59:59.999Z')
      
      console.log('查询当天排期和草稿范围:', {
        输入日期: body.playDate,
        开始时间: startOfDay.toISOString(),
        结束时间: endOfDay.toISOString()
      })
      
      // 查找当天的所有排期和草稿（包括草稿状态的）
      const sameDaySchedules = await db.select()
        .from(schedules)
        .where(and(
          gte(schedules.playDate, startOfDay),
          lte(schedules.playDate, endOfDay)
        ))
        .orderBy(desc(schedules.sequence))
        .limit(1)
      
      if (sameDaySchedules.length > 0) {
        sequence = (sameDaySchedules[0].sequence || 0) + 1
      }
    }
    
    // 解析输入的日期字符串，确保日期正确
    const inputDateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
    
    // 直接使用输入的日期字符串，添加时间部分以避免时区问题
    const playDate = new Date(inputDateStr + 'T00:00:00.000Z')
    
    // 创建草稿排期
    const scheduleResult = await db.insert(schedules)
      .values({
        songId: body.songId,
        playDate: playDate,
        sequence: sequence,
        playTimeId: body.playTimeId || null,
        isDraft: true,  // 标记为草稿
        publishedAt: null  // 草稿状态下没有发布时间
      })
      .returning()
    
    const schedule = {
      ...scheduleResult[0],
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        requesterId: song.requesterId
      }
    }
    
    // 清除相关缓存
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache()
      console.log('[Cache] 排期缓存和歌曲列表缓存已清除（保存草稿）')
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }
    
    return {
      ...schedule,
      isDraft: true,
      publishedAt: null,
      message: '排期草稿保存成功'
    }
  } catch (error: any) {
    console.error('保存排期草稿失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '保存排期草稿失败'
    })
  }
})