import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users } from '~/drizzle/schema'
import { and, count, eq, gte, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const query = getQuery(event)
  const semester = query.semester as string

  try {
    const songWhereCondition = semester && semester !== 'all' ? eq(songs.semester, semester) : undefined

    // 获取用户参与度数据
    // 1. 获取总用户数
    const totalUsersResult = await db.select({ count: count() }).from(users)
    const totalUsers = Number(totalUsersResult[0]?.count || 0)

    // 2. 获取有请求歌曲的用户数
    const activeUsersResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${songs.requesterId})` })
      .from(songs)
      .where(songWhereCondition)
    const activeUsers = Number(activeUsersResult[0]?.count || 0)

    // 3. 获取用户请求歌曲的平均数量
    const totalSongRequestsResult = await db
      .select({ count: count() })
      .from(songs)
      .where(songWhereCondition)
    const totalSongRequests = Number(totalSongRequestsResult[0]?.count || 0)
    const averageSongsPerUser = totalUsers > 0 ? totalSongRequests / totalUsers : 0

    // 4. 获取最近活跃用户
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const recentWhereCondition = songWhereCondition
      ? and(songWhereCondition, gte(songs.createdAt, oneWeekAgo))
      : gte(songs.createdAt, oneWeekAgo)
    const recentActiveUsersResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${songs.requesterId})` })
      .from(songs)
      .where(recentWhereCondition)
    const recentActiveUsers = Number(recentActiveUsersResult[0]?.count || 0)

    return {
      totalUsers,
      activeUsers,
      activeUserPercentage: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
      averageSongsPerUser: parseFloat(averageSongsPerUser.toFixed(2)),
      recentActiveUsers,
      recentActiveUserPercentage: totalUsers > 0 ? (recentActiveUsers / totalUsers) * 100 : 0
    }
  } catch (error) {
    console.error('获取用户参与度数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取用户参与度数据失败'
    })
  }
})
