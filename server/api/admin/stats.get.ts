import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { schedules, semesters, songBlacklists, songs, users } from '~/drizzle/schema'
import { and, count, eq, gte, lt } from 'drizzle-orm'
import { cacheService } from '../../services/cacheService'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const BEIJING_TIMEZONE = 'Asia/Shanghai'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const query = getQuery(event)
  const semester = query.semester as string

  try {
    // 尝试从缓存获取数据
    const cachedStats = await cacheService.getAdminStats(semester)
    if (cachedStats) {
      console.log('[Cache] 管理员统计数据缓存命中')
      return cachedStats
    }
    // 获取当前时间相关的日期
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // 构建查询条件
    const where = semester && semester !== 'all' ? { semester: semester } : {}

    // 构建排期查询条件
    const scheduleBaseWhere = semester && semester !== 'all' ? { song: { semester: semester } } : {}

    // 添加日期条件到今日排期查询
    const todayScheduleWhere = {
      ...scheduleBaseWhere,
      playDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    }

    // 并行获取所有统计数据
    const [
      totalSongs,
      totalUsers,
      todaySchedules,
      totalSchedules,
      weeklyRequests,
      previousWeekRequests,
      songsThisWeek,
      songsLastWeek,
      usersThisWeek,
      usersLastWeek,
      currentSemester,
      blacklistCount
    ] = await Promise.all([
      // 总歌曲数
      (async () => {
        const whereCondition =
          semester && semester !== 'all' ? eq(songs.semester, semester) : undefined
        const result = await db.select({ count: count() }).from(songs).where(whereCondition)
        return result[0].count
      })(),

      // 总用户数
      (async () => {
        const result = await db.select({ count: count() }).from(users)
        return result[0].count
      })(),

      // 今日排期数 (按天计算)
      (async () => {
        const query = db.select({ playDate: schedules.playDate }).from(schedules)

        const whereConditions = [
          gte(schedules.playDate, today),
          lt(schedules.playDate, new Date(today.getTime() + 24 * 60 * 60 * 1000))
        ]

        if (semester && semester !== 'all') {
          query.innerJoin(songs, eq(schedules.songId, songs.id))
          whereConditions.push(eq(songs.semester, semester))
        }

        const todaySchedulesList = await query.where(and(...whereConditions))

        // 按北京时间日期去重计算天数
        const uniqueDates = new Set(
          todaySchedulesList.map((s) => dayjs(s.playDate).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'))
        )
        return uniqueDates.size
      })(),

      // 总排期数 (按天计算)
      (async () => {
        const query = db.select({ playDate: schedules.playDate }).from(schedules)

        if (semester && semester !== 'all') {
          query.innerJoin(songs, eq(schedules.songId, songs.id)).where(eq(songs.semester, semester))
        }

        const allSchedules = await query

        // 按北京时间日期去重计算天数
        const uniqueDates = new Set(
          allSchedules.map((s) => dayjs(s.playDate).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'))
        )
        return uniqueDates.size
      })(),

      // 本周点歌数
      (async () => {
        const whereConditions = [gte(songs.createdAt, weekAgo)]
        if (semester && semester !== 'all') {
          whereConditions.push(eq(songs.semester, semester))
        }
        const result = await db
          .select({ count: count() })
          .from(songs)
          .where(and(...whereConditions))
        return result[0].count
      })(),

      // 上周点歌数
      (async () => {
        const whereConditions = [gte(songs.createdAt, twoWeeksAgo), lt(songs.createdAt, weekAgo)]
        if (semester && semester !== 'all') {
          whereConditions.push(eq(songs.semester, semester))
        }
        const result = await db
          .select({ count: count() })
          .from(songs)
          .where(and(...whereConditions))
        return result[0].count
      })(),

      // 本周新增歌曲
      (async () => {
        const whereConditions = [gte(songs.createdAt, weekAgo)]
        if (semester && semester !== 'all') {
          whereConditions.push(eq(songs.semester, semester))
        }
        const result = await db
          .select({ count: count() })
          .from(songs)
          .where(and(...whereConditions))
        return result[0].count
      })(),

      // 上周新增歌曲
      (async () => {
        const whereConditions = [gte(songs.createdAt, twoWeeksAgo), lt(songs.createdAt, weekAgo)]
        if (semester && semester !== 'all') {
          whereConditions.push(eq(songs.semester, semester))
        }
        const result = await db
          .select({ count: count() })
          .from(songs)
          .where(and(...whereConditions))
        return result[0].count
      })(),

      // 本周新增用户
      (async () => {
        const result = await db
          .select({ count: count() })
          .from(users)
          .where(gte(users.createdAt, weekAgo))
        return result[0].count
      })(),

      // 上周新增用户
      (async () => {
        const result = await db
          .select({ count: count() })
          .from(users)
          .where(and(gte(users.createdAt, twoWeeksAgo), lt(users.createdAt, weekAgo)))
        return result[0].count
      })(),

      // 当前学期
      (async () => {
        const result = await db
          .select({ name: semesters.name })
          .from(semesters)
          .where(eq(semesters.isActive, true))
          .limit(1)
        return result[0]
      })(),

      // 黑名单项目数
      (async () => {
        const blacklistCount = await db
          .select({ count: count() })
          .from(songBlacklists)
          .where(eq(songBlacklists.isActive, true))
        return blacklistCount[0].count
      })()
    ])

    // 计算变化百分比
    const requestsChange =
      previousWeekRequests > 0
        ? Math.round(((weeklyRequests - previousWeekRequests) / previousWeekRequests) * 100)
        : weeklyRequests > 0
          ? 100
          : 0

    const songsChange = songsThisWeek - songsLastWeek
    const usersChange = usersThisWeek - usersLastWeek

    // 获取趋势数据 (最近7天)
    const trendData = await Promise.all([
      // 歌曲趋势
      (async () => {
        const trends = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

          const whereConditions = [gte(songs.createdAt, startOfDay), lt(songs.createdAt, endOfDay)]
          if (semester && semester !== 'all') {
            whereConditions.push(eq(songs.semester, semester))
          }
          const result = await db
            .select({ count: count() })
            .from(songs)
            .where(and(...whereConditions))
          const countValue = result[0].count

          trends.push({
            date: dayjs(startOfDay).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'),
            count: countValue
          })
        }
        return trends
      })(),

      // 用户趋势
      (async () => {
        const trends = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

          const result = await db
            .select({ count: count() })
            .from(users)
            .where(and(gte(users.createdAt, startOfDay), lt(users.createdAt, endOfDay)))
          const countValue = result[0].count

          trends.push({
            date: dayjs(startOfDay).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'),
            count: countValue
          })
        }
        return trends
      })(),

      // 排期趋势
      (async () => {
        const trends = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

          const query = db.select({ playDate: schedules.playDate }).from(schedules)

          const whereConditions = [
            gte(schedules.playDate, startOfDay),
            lt(schedules.playDate, endOfDay)
          ]

          if (semester && semester !== 'all') {
            query.innerJoin(songs, eq(schedules.songId, songs.id))
            whereConditions.push(eq(songs.semester, semester))
          }

          const schedulesList = await query.where(and(...whereConditions))

          // 按北京时间日期去重计算天数
          const uniqueDates = new Set(
            schedulesList.map((s) => dayjs(s.playDate).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'))
          )

          trends.push({
            date: dayjs(startOfDay).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'),
            count: uniqueDates.size
          })
        }
        return trends
      })(),

      // 点歌请求趋势
      (async () => {
        const trends = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

          const whereConditions = [gte(songs.createdAt, startOfDay), lt(songs.createdAt, endOfDay)]
          if (semester && semester !== 'all') {
            whereConditions.push(eq(songs.semester, semester))
          }
          const result = await db
            .select({ count: count() })
            .from(songs)
            .where(and(...whereConditions))
          const countValue = result[0].count

          trends.push({
            date: dayjs(startOfDay).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD'),
            count: countValue
          })
        }
        return trends
      })()
    ])

    const result = {
      totalSongs,
      totalUsers,
      todaySchedules,
      totalSchedules,
      weeklyRequests,
      songsChange,
      usersChange,
      requestsChange,
      currentSemester: currentSemester?.name || null,
      blacklistCount,
      // 趋势数据
      songsTrend: trendData[0],
      usersTrend: trendData[1],
      schedulesTrend: trendData[2],
      requestsTrend: trendData[3]
    }

    // 缓存结果
    await cacheService.setAdminStats(semester, result)

    // 只在Redis可用时显示缓存提示
    const { isRedisReady } = await import('../../utils/redis')
    if (isRedisReady()) {
      console.log('[Cache] 管理员统计数据已缓存')
    }

    return result
  } catch (error) {
    console.error('获取统计数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取统计数据失败'
    })
  }
})
