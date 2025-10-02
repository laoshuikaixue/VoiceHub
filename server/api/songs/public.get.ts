import { createError, defineEventHandler, getQuery, getCookie, getHeader } from 'h3'
import jwt from 'jsonwebtoken'
import { db } from '~/drizzle/db'
import { schedules, songs, users, playTimes, systemSettings, votes } from '~/drizzle/schema'
import { eq, and, count, sql } from 'drizzle-orm'
import { cacheService } from '~/server/services/cacheService'
import { isRedisReady, executeRedisCommand } from '../../utils/redis'
import { formatBeijingTime } from '~/utils/timeUtils'

// 格式化日期时间为统一格式：YYYY/M/D H:mm:ss（北京时间）
function formatDateTime(date: Date): string {
  return formatBeijingTime(date, 'YYYY/M/D H:mm:ss')
}

// 姓名模糊化函数
function maskStudentName(name: string): string {
  if (!name) return name
  
  const length = name.length
  if (length === 1) {
    return '*'
  } else if (length === 2) {
    return name[0] + '*'
  } else {
    return name[0] + '*'.repeat(length - 1)
  }
}

export default defineEventHandler(async (event) => {
  try {
    // 获取查询参数
    const query = getQuery(event)
    const semester = query.semester as string
    const bypassCache = query.bypass_cache === 'true'
    
    // 检查用户是否已登录
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    let isLoggedIn = false
    
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET!)
        isLoggedIn = true
      } catch (error) {
        // Token 无效，用户未登录
        isLoggedIn = false
      }
    }
    
    // 获取系统设置
    const systemSettingsData = await db.select().from(systemSettings).limit(1).then(result => result[0])
    const shouldHideStudentInfo = systemSettingsData?.hideStudentInfo ?? true
    
    // 初始化缓存服务
    
    // 获取当前日期，使用UTC时间
    const now = new Date()
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ))
    
    // 构建缓存键
    const cacheKey = semester ? `public_schedules:${semester}` : 'public_schedules:all'
    
    // 如果不绕过缓存，优先从Redis缓存获取排期数据
    if (!bypassCache && isRedisReady()) {
      const cachedData = await executeRedisCommand(async () => {
        const client = (await import('../../utils/redis')).getRedisClient()
        if (!client) return null
        
        const data = await client.get(cacheKey)
        if (data) {
          const parsedData = JSON.parse(data)
          console.log(`[Cache] 公共排期Redis缓存命中: ${cacheKey}，数量: ${parsedData.length}`)
          // 深拷贝数据以避免修改缓存的原始数据
          const resultData = JSON.parse(JSON.stringify(parsedData))
          // 如果需要隐藏学生信息且用户未登录，则模糊化姓名
          if (shouldHideStudentInfo && !isLoggedIn) {
            resultData.forEach((item: any) => {
              if (item.song?.requester) {
                item.song.requester = maskStudentName(item.song.requester)
              }
            })
          }
          return resultData
        }
        
        return null
      })
      
      if (cachedData) {
        return cachedData
      }
    }
    
    // 如果不绕过缓存，Redis缓存未命中，尝试从CacheService获取（CacheService缓存所有学期数据）
    let cachedSchedules = null
    if (!bypassCache) {
      cachedSchedules = await cacheService.getSchedulesList()
    }
    
    if (cachedSchedules && cachedSchedules.length > 0) {
      console.log(`[Cache] CacheService排期缓存命中（所有学期），数量: ${cachedSchedules.length}`)
      // 如果指定了学期，过滤数据
      let filteredSchedules = cachedSchedules
      if (semester) {
        filteredSchedules = cachedSchedules.filter(s => s.song?.semester === semester)
        console.log(`[Cache] 过滤学期 ${semester} 后的数量: ${filteredSchedules.length}`)
      }
      
      // 将过滤后的数据缓存到Redis（缓存完整数据，不进行模糊化）
      if (isRedisReady()) {
        await executeRedisCommand(async () => {
          const client = (await import('../../utils/redis')).getRedisClient()
          if (!client) return
          
          await client.set(cacheKey, JSON.stringify(filteredSchedules))
          console.log(`[Cache] 排期数据设置Redis缓存: ${cacheKey}，数量: ${filteredSchedules.length}`)
        })
      }
      
      // 深拷贝数据以避免修改缓存的原始数据
      const resultData = JSON.parse(JSON.stringify(filteredSchedules))
      // 如果需要隐藏学生信息且用户未登录，则模糊化姓名
      if (shouldHideStudentInfo && !isLoggedIn) {
        resultData.forEach((item: any) => {
          if (item.song?.requester) {
            item.song.requester = maskStudentName(item.song.requester)
          }
        })
      }
      
      return resultData
    }
    
    // 获取排期的歌曲，包含播放时段信息（查询所有学期的数据）
    const schedulesData = await db.select({
      id: schedules.id,
      playDate: schedules.playDate,
      sequence: schedules.sequence,
      played: schedules.played,
      playTimeId: schedules.playTimeId,
      song: {
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        played: songs.played,
        cover: songs.cover,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        semester: songs.semester,
        requesterId: songs.requesterId,
        createdAt: songs.createdAt
      },
      requester: {
        name: users.name,
        grade: users.grade,
        class: users.class
      },
      playTime: {
        id: playTimes.id,
        name: playTimes.name,
        startTime: playTimes.startTime,
        endTime: playTimes.endTime,
        enabled: playTimes.enabled
      }
    })
    .from(schedules)
    .leftJoin(songs, eq(schedules.songId, songs.id))
    .leftJoin(users, eq(songs.requesterId, users.id))
    .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
    .where(eq(schedules.isDraft, false))  // 只查询已发布的排期
    .orderBy(schedules.playDate)

    // 获取每首歌的投票数
    const voteCountsQuery = await db.select({
      songId: votes.songId,
      count: count(votes.id)
    })
    .from(votes)
    .groupBy(votes.songId)
    
    const voteCounts = new Map(voteCountsQuery.map(v => [v.songId, v.count]))

    // 获取所有用户的姓名列表，用于检测同名用户
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      grade: users.grade,
      class: users.class
    }).from(users)
    
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
    
    // 转换数据格式
    const formattedSchedules = schedulesData.map(schedule => {
      // 获取原始日期，并确保使用UTC时间
      const originalDate = new Date(schedule.playDate)
      
      // 创建一个新的日期对象，保留原始日期的年月日，但使用UTC时间
      const dateOnly = new Date(Date.UTC(
        originalDate.getUTCFullYear(),
        originalDate.getUTCMonth(),
        originalDate.getUTCDate(),
        0, 0, 0, 0
      ))
      
      // 处理投稿人姓名，如果是同名用户则添加后缀
      let requesterName = schedule.requester.name || '未知用户'
      
      // 检查是否有同名用户
      const sameNameUsers = nameToUsers.get(requesterName)
      if (sameNameUsers && sameNameUsers.length > 1) {
        const requesterWithGradeClass = schedule.requester
        
        // 如果有年级信息，则添加年级后缀
        if (requesterWithGradeClass.grade) {
          // 检查同一个年级是否有同名
          const sameGradeUsers = sameNameUsers.filter((u: {id: number, name: string | null, grade: string | null, class: string | null}) => 
            u.grade === requesterWithGradeClass.grade
          )
          
          if (sameGradeUsers.length > 1 && requesterWithGradeClass.class) {
            // 同一个年级有同名，添加班级后缀
            requesterName = `${requesterName}（${requesterWithGradeClass.grade} ${requesterWithGradeClass.class}）`
          } else {
            // 只添加年级后缀
            requesterName = `${requesterName}（${requesterWithGradeClass.grade}）`
          }
        }
      }
      
      // 注意：这里不进行模糊化处理，保持完整数据用于缓存
      // 模糊化处理将在最终返回时进行
      
      return {
        id: schedule.id,
        playDate: dateOnly.toISOString().split('T')[0], // 转换为YYYY-MM-DD格式字符串
        sequence: schedule.sequence || 1,
        played: schedule.played || false,
        playTimeId: schedule.playTimeId, // 添加播放时段ID
        playTime: schedule.playTime ? {
          id: schedule.playTime.id,
          name: schedule.playTime.name,
          startTime: schedule.playTime.startTime,
          endTime: schedule.playTime.endTime,
          enabled: schedule.playTime.enabled
        } : null, // 添加播放时段信息
        song: {
          id: schedule.song.id,
          title: schedule.song.title,
          artist: schedule.song.artist,
          requester: requesterName,
          voteCount: voteCounts.get(schedule.song.id) || 0,
          played: schedule.song.played || false,
          cover: schedule.song.cover || null,
          musicPlatform: schedule.song.musicPlatform || null,
          musicId: schedule.song.musicId || null,
          semester: schedule.song.semester || null,
          requestedAt: schedule.song.createdAt ? formatDateTime(schedule.song.createdAt) : null
        }
      }
    })

    const allSchedulesResult = formattedSchedules
    
    // 始终缓存所有学期的数据到CacheService
    if (allSchedulesResult && allSchedulesResult.length > 0) {
      await cacheService.setSchedulesList(allSchedulesResult)
      console.log(`[Cache] 公共排期设置CacheService缓存（所有学期），数量: ${allSchedulesResult.length}`)
    }
    
    // 准备要返回和缓存的数据
    let finalResult = allSchedulesResult
    if (semester && allSchedulesResult) {
      finalResult = allSchedulesResult.filter(s => s.song?.semester === semester)
    }
    
    // 缓存结果到Redis（如果可用）- 根据请求参数缓存相应数据
    if (finalResult && isRedisReady()) {
      await executeRedisCommand(async () => {
        const client = (await import('../../utils/redis')).getRedisClient()
        if (!client) return
        
        await client.set(cacheKey, JSON.stringify(finalResult))
        console.log(`[Cache] 排期数据设置Redis缓存: ${cacheKey}，数量: ${finalResult.length}`)
      })
    }

    // 深拷贝数据以避免修改缓存的原始数据
    const resultToReturn = JSON.parse(JSON.stringify(finalResult || allSchedulesResult))
    
    // 如果需要隐藏学生信息且用户未登录，则模糊化姓名
    if (shouldHideStudentInfo && !isLoggedIn && resultToReturn) {
      resultToReturn.forEach((item: any) => {
        if (item.song?.requester) {
          item.song.requester = maskStudentName(item.song.requester)
        }
      })
    }

    return resultToReturn
  } catch (error: any) {
    console.error('获取公共排期失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '获取排期数据失败'
    })
  }
})