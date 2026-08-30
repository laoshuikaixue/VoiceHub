import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users, userIdentities, votes } from '~/drizzle/schema'
import { count, eq, gte, inArray } from 'drizzle-orm'
import { getBeijingHour, getBeijingStartOfDay } from '~/utils/timeUtils'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  try {
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
              name: song.requesterName,
              avatar: null
            })
          })

          // 添加登录用户
          recentLoginUsers.forEach((user) => {
            userMap.set(user.id, {
              id: user.id,
              username: user.username,
              name: user.name,
              avatar: null
            })
          })

          // 添加点赞用户
          recentVoteUsers.forEach((vote) => {
            userMap.set(vote.userId2, {
              id: vote.userId2,
              username: vote.userUsername,
              name: vote.userName,
              avatar: null
            })
          })

          // 解析头像（与用户管理面板同源：优先用户选中的身份，否则按创建顺序取第一个可用头像）
          const activeUserIds = Array.from(userMap.keys())
          if (activeUserIds.length > 0) {
            const [userPrefs, identities] = await Promise.all([
              db
                .select({
                  id: users.id,
                  avatarProvider: users.avatarProvider,
                  avatarProviderUserId: users.avatarProviderUserId
                })
                .from(users)
                .where(inArray(users.id, activeUserIds)),
              db
                .select({
                  userId: userIdentities.userId,
                  provider: userIdentities.provider,
                  providerUsername: userIdentities.providerUsername,
                  providerUserId: userIdentities.providerUserId,
                  avatar: userIdentities.avatar,
                  createdAt: userIdentities.createdAt
                })
                .from(userIdentities)
                .where(inArray(userIdentities.userId, activeUserIds))
            ])

            const prefsMap = new Map(userPrefs.map((pref) => [pref.id, pref]))
            const identitiesMap = new Map()
            identities.forEach((identity) => {
              if (!identitiesMap.has(identity.userId)) {
                identitiesMap.set(identity.userId, [])
              }
              identitiesMap.get(identity.userId).push(identity)
            })

            userMap.forEach((info, id) => {
              const pref = prefsMap.get(id)
              const avatarSource = resolveAvatarSource(
                {
                  avatarProvider: pref?.avatarProvider,
                  avatarProviderUserId: pref?.avatarProviderUserId
                },
                identitiesMap.get(id) || []
              )
              info.avatar = avatarSource?.url ?? null
            })
          }

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

    return result
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: '获取实时统计数据失败'
    })
  }
})
