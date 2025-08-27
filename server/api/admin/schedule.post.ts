import { db } from '~/drizzle/db'
import { songs, schedules, users, playTimes, votes } from '~/drizzle/schema'
import { eq, gte, lte, desc, asc, count, and } from 'drizzle-orm'
import { createSongSelectedNotification } from '../../services/notificationService'
import { CacheService } from '~/server/services/cacheService'

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
      message: '只有歌曲管理员及以上权限才能创建排期'
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
    
    // 检查是否已经为该歌曲创建过排期，如果有则删除旧的排期
    const existingScheduleResult = await db.select()
      .from(schedules)
      .where(eq(schedules.songId, body.songId))
      .limit(1)
    
    const existingSchedule = existingScheduleResult[0]
    if (existingSchedule) {
      // 删除现有排期
      await db.delete(schedules)
        .where(eq(schedules.id, existingSchedule.id))
    }
    
    // 获取序号，如果未提供则查找当天最大序号+1
    let sequence = body.sequence || 1
    
    if (!body.sequence) {
      // 解析输入的日期字符串，确保使用UTC时间
      const inputDateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
      
      // 提取年月日部分（不管输入格式如何）
      const dateParts = inputDateStr.split('T')[0].split('-')
      const year = parseInt(dateParts[0])
      const month = parseInt(dateParts[1]) - 1 // 月份从0开始
      const day = parseInt(dateParts[2])
      
      // 创建UTC日期，只包含日期部分
      const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
      
      console.log('查询当天排期范围:', {
        输入日期: body.playDate,
        开始时间: startOfDay.toISOString(),
        结束时间: endOfDay.toISOString()
      })
      
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
    
    // 解析输入的日期字符串，确保使用UTC时间
    const inputDateStr = typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
    
    // 提取年月日部分（不管输入格式如何）
    const dateParts = inputDateStr.split('T')[0].split('-')
    const year = parseInt(dateParts[0])
    const month = parseInt(dateParts[1]) - 1 // 月份从0开始
    const day = parseInt(dateParts[2])
    
    // 创建UTC日期，只包含日期部分
    const playDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
    
    // 创建排期
    const scheduleResult = await db.insert(schedules)
      .values({
        songId: body.songId,
        playDate: playDate,
        sequence: sequence,
        playTimeId: body.playTimeId || null
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
    
    // 创建通知
    await createSongSelectedNotification(schedule.song.requesterId, schedule.song.id, {
      title: schedule.song.title,
      artist: schedule.song.artist,
      playDate: schedule.playDate
    })
    
    // 清除相关缓存
    const { cache } = await import('~/server/utils/cache-helpers')
    await cache.deletePattern('schedules:*')
    await cache.deletePattern('stats:*')
    console.log('[Cache] 排期缓存和统计缓存已清除（创建排期）')
    
    // 重新缓存完整的排期列表
    try {
      // 获取所有排期数据
      const schedulesData = await db.select({
        id: schedules.id,
        playDate: schedules.playDate,
        sequence: schedules.sequence,
        played: schedules.played,
        playTimeId: schedules.playTimeId,
        songId: schedules.songId,
        songTitle: songs.title,
        songArtist: songs.artist,
        songRequesterId: songs.requesterId,
        songPlayed: songs.played,
        songCover: songs.cover,
        songMusicPlatform: songs.musicPlatform,
        songMusicId: songs.musicId,
        songSemester: songs.semester,
        requesterName: users.name,
        requesterGrade: users.grade,
        requesterClass: users.class,
        playTimeName: playTimes.name,
        playTimeStartTime: playTimes.startTime,
        playTimeEndTime: playTimes.endTime,
        playTimeEnabled: playTimes.enabled
      })
        .from(schedules)
        .innerJoin(songs, eq(schedules.songId, songs.id))
        .innerJoin(users, eq(songs.requesterId, users.id))
        .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
        .orderBy(asc(schedules.playDate))
        
      // 获取所有用户的姓名列表，用于检测同名用户
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        grade: users.grade,
        class: users.class
      })
        .from(users)
        
      // 创建姓名到用户数组的映射
      const nameToUsers = new Map()
      allUsers.forEach(user => {
        if (user.name) {
          if (!nameToUsers.has(user.name)) {
            nameToUsers.set(user.name, [])
          }
          nameToUsers.get(user.name).push(user)
        }
      })
        
      // 获取每首歌的投票数
      const songIds = schedulesData.map(s => s.songId)
      const voteCounts = await Promise.all(
        songIds.map(async (songId) => {
          const voteCountResult = await db.select({ count: count() })
            .from(votes)
            .where(eq(votes.songId, songId))
          return { songId, count: voteCountResult[0].count }
        })
      )
      
      const voteCountMap = new Map(voteCounts.map(v => [v.songId, v.count]))
      
      // 转换数据格式
      const formattedSchedules = schedulesData.map(schedule => {
        const originalDate = new Date(schedule.playDate)
        const dateOnly = new Date(Date.UTC(
          originalDate.getUTCFullYear(),
          originalDate.getUTCMonth(),
          originalDate.getUTCDate(),
          0, 0, 0, 0
        ))
        
        // 处理投稿人姓名，如果是同名用户则添加后缀
        let requesterName = schedule.requesterName || '未知用户'
        
        const sameNameUsers = nameToUsers.get(requesterName)
        if (sameNameUsers && sameNameUsers.length > 1) {
          if (schedule.requesterGrade) {
            const sameGradeUsers = sameNameUsers.filter((u: {id: number, name: string | null, grade: string | null, class: string | null}) => 
              u.grade === schedule.requesterGrade
            )
            
            if (sameGradeUsers.length > 1 && schedule.requesterClass) {
              requesterName = `${requesterName}（${schedule.requesterGrade} ${schedule.requesterClass}）`
            } else {
              requesterName = `${requesterName}（${schedule.requesterGrade}）`
            }
          }
        }
          
        return {
          id: schedule.id,
          playDate: dateOnly.toISOString().split('T')[0],
          sequence: schedule.sequence || 1,
          played: schedule.played || false,
          playTimeId: schedule.playTimeId,
          playTime: schedule.playTimeName ? {
            id: schedule.playTimeId,
            name: schedule.playTimeName,
            startTime: schedule.playTimeStartTime,
            endTime: schedule.playTimeEndTime,
            enabled: schedule.playTimeEnabled
          } : null,
          song: {
            id: schedule.songId,
            title: schedule.songTitle,
            artist: schedule.songArtist,
            requester: requesterName,
            voteCount: voteCountMap.get(schedule.songId) || 0,
            played: schedule.songPlayed || false,
            cover: schedule.songCover || null,
            musicPlatform: schedule.songMusicPlatform || null,
            musicId: schedule.songMusicId || null,
            semester: schedule.songSemester || null
          }
        }
      })
      
      const completeSchedules = formattedSchedules
      
      // 重新缓存完整的排期列表
      if (completeSchedules && completeSchedules.length > 0) {
        await cacheService.setSchedulesList(completeSchedules)
        console.log(`[Cache] 完整排期列表已重新缓存，数量: ${completeSchedules.length}`)
      } else {
        console.log('[Cache] 没有排期数据需要缓存')
      }
    } catch (cacheError) {
      console.warn('[Cache] 重新缓存完整排期列表失败，但不影响排期创建:', cacheError)
    }
    
    return schedule
  } catch (error: any) {
    console.error('创建排期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '创建排期失败'
    })
  }
})