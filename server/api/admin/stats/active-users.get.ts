import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users, votes } from '~/drizzle/schema'
import { CacheService } from '../../../services/cacheService'

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
  const limit = parseInt(query.limit as string) || 20

  try {
    // 尝试从缓存获取数据
    const cacheService = CacheService.getInstance()
    const cachedStats = await cacheService.getActiveUsersStats(semester, limit)
    if (cachedStats) {
      console.log('[Cache] 活跃用户统计数据缓存命中')
      return cachedStats
    }

    // 构建查询条件 - 如果没有指定学期或学期为'all'，查询所有用户
    let songWhere = {}
    if (semester && semester !== 'all') {
      songWhere = { semester: semester }
    }

    // 获取活跃用户数据 - 有投稿歌曲的用户
    const allUsers = await db.select().from(users)
    const allSongs = await db.select().from(songs)
    const allVotes = await db.select().from(votes)

    // 过滤有投稿歌曲的用户
    const activeUsers = allUsers
      .filter((user) => {
        const userSongs = allSongs.filter((song) => {
          if (song.requesterId !== user.id) return false
          if (semester && semester !== 'all' && song.semester !== semester) return false
          return true
        })
        return userSongs.length > 0
      })
      .map((user) => {
        const userSongs = allSongs
          .filter((song) => {
            if (song.requesterId !== user.id) return false
            if (semester && semester !== 'all' && song.semester !== semester) return false
            return true
          })
          .map((song) => ({
            ...song,
            votes: allVotes.filter((vote) => vote.songId === song.id)
          }))

        return {
          ...user,
          songs: userSongs
        }
      })

    // 如果没有活跃用户，返回空数组
    if (activeUsers.length === 0) {
      const emptyResult = []
      // 缓存空结果
      await cacheService.setActiveUsersStats(semester, limit, emptyResult)
      console.log('[Cache] 活跃用户统计数据已缓存（空结果）')
      return emptyResult
    }

    // 计算每个用户的活跃度数据
    const userStats = activeUsers.map((user) => {
      const contributions = user.songs.length
      const likes = user.songs.reduce((total, song) => total + song.votes.length, 0)

      // 活跃度计算：投稿数 * 2 + 点赞数 * 0.5
      const activityScore = Math.round(contributions * 2 + likes * 0.5)

      const userStat = {
        id: user.id,
        name: user.name || user.username, // 优先显示真实姓名，如果没有则显示登录名
        contributions,
        likes,
        activityScore
      }

      return userStat
    })

    // 按活跃度分数降序排列并限制数量
    const sortedUsers = userStats.sort((a, b) => b.activityScore - a.activityScore).slice(0, limit)

    // 缓存结果
    await cacheService.setActiveUsersStats(semester, limit, sortedUsers)
    console.log('[Cache] 活跃用户统计数据已缓存')

    return sortedUsers
  } catch (error) {
    // 返回空数组而不是抛出错误，避免前端显示错误
    return []
  }
})
