import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { CacheService } from '../../../services/cacheService'
import { songs, users, votes } from '~/drizzle/schema'
import { count, eq, gte } from 'drizzle-orm'
import { getBeijingHour, getBeijingStartOfDay } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  try {
    // 尝试从缓存获取数据
    const cacheService = CacheService.getInstance()
    const cachedStats = await cacheService.getRealtimeStats()
    if (cachedStats) {
      console.log('[Cache] 实时统计数据缓存命中')
      return cachedStats
    }
    // 获取当前时间相关的日期
    const now = new Date()
    const today = getBeijingStartOfDay() // 使用北京时间的一天开始
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 并行获取实时统计数据
    const [activeUsersData, todayRequests, popularGenres, peakHours] = await Promise.all([
      // 活跃用户数和用户列表 (最近1小时点歌、登录或点赞的用户)
      (async () => {
        try {
          // 获取最近1小时内点歌的用户
          const recentSongUsers = await db
            .select({
              requesterId: songs.requesterId,
              requesterName: users.name,
              requesterUsername: users.username,
              requesterId2: users.id
            })
            .from(songs)
            .innerJoin(users, eq(songs.requesterId, users.id))
            .where(gte(songs.createdAt, oneHourAgo))
            .groupBy(songs.requesterId, users.id, users.name, users.username)

          // 获取最近1小时内登录的用户
          const recentLoginUsers = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)
            .where(gte(users.lastLogin, oneHourAgo))

          // 获取最近1小时内点赞过歌曲的用户
          const recentVoteUsers = await db
            .select({
              userId: votes.userId,
              userName: users.name,
              userUsername: users.username,
              userId2: users.id
            })
            .from(votes)
            .innerJoin(users, eq(votes.userId, users.id))
            .where(gte(votes.createdAt, oneHourAgo))
            .groupBy(votes.userId, users.id, users.name, users.username)

          // 合并并去重用户列表
          const userMap = new Map()

          // 添加点歌用户
          recentSongUsers.forEach((song) => {
            userMap.set(song.requesterId2, {
              id: song.requesterId2,
              username: song.requesterUsername,
              name: song.requesterName
            })
          })

          // 添加登录用户
          recentLoginUsers.forEach((user) => {
            userMap.set(user.id, {
              id: user.id,
              username: user.username,
              name: user.name
            })
          })

          // 添加点赞用户
          recentVoteUsers.forEach((vote) => {
            userMap.set(vote.userId2, {
              id: vote.userId2,
              username: vote.userUsername,
              name: vote.userName
            })
          })

          const activeUsersList = Array.from(userMap.values())

          return {
            count: activeUsersList.length,
            users: activeUsersList
          }
        } catch (error) {
          return {
            count: 0,
            users: []
          }
        }
      })(),

      // 今日点歌数
      (async () => {
        try {
          const todayCountResult = await db
            .select({ count: count() })
            .from(songs)
            .where(gte(songs.createdAt, today))
          return todayCountResult[0].count
        } catch (error) {
          return 0
        }
      })(),

      // 热门流派 (Song模型中没有genre字段，返回空数组)
      (async () => {
        return []
      })(),

      // 高峰时段 (最近7天的小时统计)
      (async () => {
        try {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const songsData = await db
            .select({
              createdAt: songs.createdAt
            })
            .from(songs)
            .where(gte(songs.createdAt, sevenDaysAgo))

          // 按小时统计
          const hourCount = songsData.reduce(
            (acc, song) => {
              const hour = getBeijingHour(song.createdAt)
              acc[hour] = (acc[hour] || 0) + 1
              return acc
            },
            {} as Record<number, number>
          )

          // 返回前3个高峰时段
          return Object.entries(hourCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([hour, count]) => ({
              hour: parseInt(hour),
              count,
              label: `${hour}:00-${parseInt(hour) + 1}:00`
            }))
        } catch (error) {
          return []
        }
      })()
    ])

    const result = {
      activeUsers: activeUsersData.count,
      activeUsersList: activeUsersData.users,
      todayRequests,
      popularGenres,
      peakHours,
      timestamp: now.toISOString()
    }

    // 缓存结果
    await cacheService.setRealtimeStats(result)
    console.log('[Cache] 实时统计数据已缓存')

    return result
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: '获取实时统计数据失败'
    })
  }
})
