import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../models/schema'

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
    // 获取当前时间相关的日期
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 并行获取实时统计数据
    const [
      activeUsers,
      todayRequests,
      popularGenres,
      peakHours
    ] = await Promise.all([
      // 活跃用户数 (简化为最近1小时点歌的用户数)
      (async () => {
        try {
          const recentSongs = await prisma.song.findMany({
            where: {
              createdAt: {
                gte: oneHourAgo
              }
            },
            select: {
              requesterId: true
            },
            distinct: ['requesterId']
          })
          return recentSongs.length
        } catch (error) {
          return 0
        }
      })(),

      // 今日点歌数
      (async () => {
        try {
          return await prisma.song.count({
            where: {
              createdAt: {
                gte: today
              }
            }
          })
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
          const songs = await prisma.song.findMany({
            where: {
              createdAt: {
                gte: sevenDaysAgo
              }
            },
            select: {
              createdAt: true
            }
          })

          // 按小时统计
          const hourCount = songs.reduce((acc, song) => {
            const hour = song.createdAt.getHours()
            acc[hour] = (acc[hour] || 0) + 1
            return acc
          }, {} as Record<number, number>)

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

    return {
      activeUsers,
      todayRequests,
      popularGenres,
      peakHours,
      timestamp: now.toISOString()
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: '获取实时统计数据失败'
    })
  }
})