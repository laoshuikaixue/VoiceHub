import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { schedules, songs, users, playTimes } from '~/drizzle/schema'
import { eq, and, desc, asc, like, or, sql, gte, lt } from 'drizzle-orm'
import { openApiCache } from '~/server/utils/open-api-cache'
import { CACHE_CONSTANTS } from '~/server/config/constants'

// 格式化日期时间为统一格式：YYYY/M/D H:mm:ss
function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const apiKey = event.context.apiKey

    console.log(`[Schedules API] 接收到请求，API Key context: ${apiKey ? '存在' : '不存在'}`)
    if (apiKey) {
      console.log(`[Schedules API] API Key ID: ${apiKey.id}, 名称: ${apiKey.name}`)
    }

    // API认证中间件已经验证了权限，这里只需要确保有API Key信息
    if (!apiKey) {
      console.log(`[Schedules API] API认证失败 - 缺少API Key context`)
      throw createError({
        statusCode: 401,
        message: 'API认证失败'
      })
    }

    const semester = query.semester as string || ''
    const date = query.date as string || ''
    const playTimeId = query.playTimeId as string || ''
    const search = query.search as string || ''
    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100) // 最大100条
    const sortBy = query.sortBy as string || 'playDate'
    const sortOrder = query.sortOrder as string || 'asc'

    // 构建缓存键
    const queryParams = {
      semester,
      date,
      playTimeId,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    }
    const cacheKey = openApiCache.generateKey('schedules', queryParams)

    // 尝试从缓存获取数据
    const cachedData = await openApiCache.get(cacheKey)
    if (cachedData) {
      return cachedData
    }

    // 构建查询条件
    const conditions = []

    if (semester) {
      conditions.push(eq(songs.semester, semester))
    }

    if (date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
      
      conditions.push(
        and(
          gte(schedules.playDate, startOfDay),
          lt(schedules.playDate, endOfDay)
        )
      )
    }

    if (playTimeId) {
      conditions.push(eq(schedules.playTimeId, parseInt(playTimeId)))
    }

    if (search) {
      conditions.push(
        or(
          like(songs.title, `%${search}%`),
          like(songs.artist, `%${search}%`)
        )
      )
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // 计算偏移量
    const offset = (page - 1) * limit

    // 查询排期数据
    const schedulesData = await db.select({
      id: schedules.id,
      playDate: schedules.playDate,
      createdAt: schedules.createdAt,
      updatedAt: schedules.updatedAt,
      song: {
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        cover: songs.cover,
        musicPlatform: songs.musicPlatform,
        musicId: songs.musicId,
        played: songs.played,
        playedAt: songs.playedAt,
        createdAt: songs.createdAt
      },
      requester: {
        id: users.id,
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
    .innerJoin(songs, eq(schedules.songId, songs.id))
    .leftJoin(users, eq(songs.requesterId, users.id))
    .leftJoin(playTimes, eq(schedules.playTimeId, playTimes.id))
    .where(whereCondition)
    .orderBy(
      sortBy === 'playDate' ? (sortOrder === 'desc' ? desc(schedules.playDate) : asc(schedules.playDate)) :
      sortBy === 'createdAt' ? (sortOrder === 'desc' ? desc(schedules.createdAt) : asc(schedules.createdAt)) :
      sortBy === 'title' ? (sortOrder === 'desc' ? desc(songs.title) : asc(songs.title)) :
      asc(schedules.playDate)
    )
    .limit(limit)
    .offset(offset)

    // 获取总数
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(schedules)
      .innerJoin(songs, eq(schedules.songId, songs.id))
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(whereCondition)
    
    const total = Number(totalResult[0].count)

    // 格式化数据
    const formattedSchedules = schedulesData.map(schedule => ({
      id: schedule.id,
      playDate: schedule.playDate,
      playDateFormatted: formatDateTime(schedule.playDate),
      semester: schedule.song.semester,
      song: {
        id: schedule.song.id,
        title: schedule.song.title,
        artist: schedule.song.artist,
        cover: schedule.song.cover,
        musicPlatform: schedule.song.musicPlatform,
        musicId: schedule.song.musicId,
        played: schedule.song.played,
        playedAt: schedule.song.playedAt,
        requestedAt: formatDateTime(schedule.song.createdAt)
      },
      requester: schedule.requester ? {
        id: schedule.requester.id,
        name: schedule.requester.name,
        grade: schedule.requester.grade,
        class: schedule.requester.class
      } : null,
      playTime: schedule.playTime ? {
        id: schedule.playTime.id,
        name: schedule.playTime.name,
        startTime: schedule.playTime.startTime,
        endTime: schedule.playTime.endTime,
        enabled: schedule.playTime.enabled
      } : null,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt
    }))

    const result = {
      success: true,
      data: {
        schedules: formattedSchedules,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }

    // 缓存结果
    await openApiCache.set(cacheKey, result, CACHE_CONSTANTS.DEFAULT_TTL)

    return result

  } catch (error: any) {
    console.error('[Open API] 获取排期列表失败:', error)

    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: 500,
        message: '获取排期列表失败'
      })
    }
  }
})