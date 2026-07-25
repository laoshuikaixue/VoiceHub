import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { playTimes, schedules, songCollaborators, songs, users } from '~/drizzle/schema'
import { and, asc, desc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm'
import { formatDateTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const apiKey = event.context.apiKey

    console.log(`[Schedules API] 接收到请求，API Key context: ${apiKey ? '存在' : '不存在'}`)

    // API认证中间件已经验证了权限，这里只需要确保有API Key信息
    if (!apiKey) {
      console.log(`[Schedules API] API认证失败 - 缺少API Key context`)
      throw createError({
        statusCode: 401,
        message: 'API认证失败'
      })
    }

    const semester = (query.semester as string) || ''
    const date = (query.date as string) || ''
    const playTimeId = (query.playTimeId as string) || ''
    const search = (query.search as string) || ''
    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100) // 最大100条
    const sortBy = (query.sortBy as string) || 'playDate'
    const sortOrder = (query.sortOrder as string) || 'asc'

    // 构建查询条件
    const conditions = [
      eq(schedules.isDraft, false) // 只查询已发布的排期
    ]

    if (semester) {
      conditions.push(eq(songs.semester, semester))
    }

    if (date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate()
      )
      const endOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate() + 1
      )

      conditions.push(and(gte(schedules.playDate, startOfDay)!, lt(schedules.playDate, endOfDay)!)!)
    }

    if (playTimeId) {
      conditions.push(eq(schedules.playTimeId, parseInt(playTimeId)))
    }

    if (search) {
      conditions.push(or(like(songs.title, `%${search}%`)!, like(songs.artist, `%${search}%`)!)!)
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // 计算偏移量
    const offset = (page - 1) * limit

    // 查询排期数据
    const schedulesData = await db
      .select({
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
          createdAt: songs.createdAt,
          semester: songs.semester
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
        sortBy === 'playDate'
          ? sortOrder === 'desc'
            ? desc(schedules.playDate)
            : asc(schedules.playDate)
          : sortBy === 'createdAt'
            ? sortOrder === 'desc'
              ? desc(schedules.createdAt)
              : asc(schedules.createdAt)
            : sortBy === 'title'
              ? sortOrder === 'desc'
                ? desc(songs.title)
                : asc(songs.title)
              : asc(schedules.playDate)
      )
      .limit(limit)
      .offset(offset)

    // 获取总数
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(schedules)
      .innerJoin(songs, eq(schedules.songId, songs.id))
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(whereCondition)

    const total = Number(totalResult[0].count)

    // 获取联合投稿人信息
    const songIds = schedulesData.map((s) => s.song.id)
    const collaboratorsMap = new Map()

    if (songIds.length > 0) {
      const collaboratorsData = await db
        .select({
          songId: songCollaborators.songId,
          user: {
            id: users.id,
            name: users.name,
            grade: users.grade,
            class: users.class
          }
        })
        .from(songCollaborators)
        .leftJoin(users, eq(songCollaborators.userId, users.id))
        .where(
          and(inArray(songCollaborators.songId, songIds), eq(songCollaborators.status, 'ACCEPTED'))
        )

      collaboratorsData.forEach((c) => {
        if (!collaboratorsMap.has(c.songId)) {
          collaboratorsMap.set(c.songId, [])
        }
        if (c.user) {
          collaboratorsMap.get(c.songId).push(c.user)
        }
      })
    }

    // 格式化数据
    const formattedSchedules = schedulesData.map((schedule) => {
      const collaborators = collaboratorsMap.get(schedule.song.id) || []

      return {
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
          requestedAt: formatDateTime(schedule.song.createdAt),
          collaborators: collaborators.map((c: any) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            class: c.class
          }))
        },
        requester: schedule.requester
          ? {
              id: schedule.requester.id,
              name: schedule.requester.name,
              grade: schedule.requester.grade,
              class: schedule.requester.class
            }
          : null,
        playTime: schedule.playTime
          ? {
              id: schedule.playTime.id,
              name: schedule.playTime.name,
              startTime: schedule.playTime.startTime,
              endTime: schedule.playTime.endTime,
              enabled: schedule.playTime.enabled
            }
          : null,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      }
    })

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
