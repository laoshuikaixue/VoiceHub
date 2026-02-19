import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users } from '~/drizzle/schema'
import { count } from 'drizzle-orm'

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
    // 构建查询条件
    const where = semester && semester !== 'all' ? { semester: semester } : {}

    // 获取用户参与度数据
    // 1. 获取总用户数
    const totalUsersResult = await db.select({ count: count() }).from(users)
    const totalUsers = totalUsersResult[0].count

    // 2. 获取有请求歌曲的用户数
    const allUsers = await db.select().from(users)
    const allSongs = await db.select().from(songs)

    const activeUsers = allUsers.filter((user) => {
      return allSongs.some((song) => {
        if (song.requesterId !== user.id) return false
        if (semester && semester !== 'all' && song.semester !== semester) return false
        return true
      })
    }).length

    // 3. 获取用户请求歌曲的平均数量
    const userSongCounts = allUsers.map((user) => {
      const songCount = allSongs.filter((song) => song.requesterId === user.id).length
      return { ...user, _count: { songs: songCount } }
    })

    const totalSongRequests = userSongCounts.reduce((sum, user) => sum + user._count.songs, 0)
    const averageSongsPerUser = totalUsers > 0 ? totalSongRequests / totalUsers : 0

    // 4. 获取最近活跃用户
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const recentActiveUsers = allUsers.filter((user) => {
      return allSongs.some((song) => {
        if (song.requesterId !== user.id) return false
        if (semester && semester !== 'all' && song.semester !== semester) return false
        if (song.createdAt < oneWeekAgo) return false
        return true
      })
    }).length

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
