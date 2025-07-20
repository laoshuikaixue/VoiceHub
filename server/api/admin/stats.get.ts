import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../models/schema'

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
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

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
      prisma.song.count(),
      
      // 总用户数
      prisma.user.count(),
      
      // 今日排期数
      prisma.schedule.count({
        where: {
          playDate: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // 总排期数
      prisma.schedule.count(),
      
      // 本周点歌数
      prisma.song.count({
        where: {
          createdAt: {
            gte: weekAgo
          }
        }
      }),
      
      // 上周点歌数
      prisma.song.count({
        where: {
          createdAt: {
            gte: twoWeeksAgo,
            lt: weekAgo
          }
        }
      }),
      
      // 本周新增歌曲
      prisma.song.count({
        where: {
          createdAt: {
            gte: weekAgo
          }
        }
      }),
      
      // 上周新增歌曲
      prisma.song.count({
        where: {
          createdAt: {
            gte: twoWeeksAgo,
            lt: weekAgo
          }
        }
      }),
      
      // 本周新增用户
      prisma.user.count({
        where: {
          createdAt: {
            gte: weekAgo
          }
        }
      }),
      
      // 上周新增用户
      prisma.user.count({
        where: {
          createdAt: {
            gte: twoWeeksAgo,
            lt: weekAgo
          }
        }
      }),
      
      // 当前学期
      prisma.semester.findFirst({
        where: { isActive: true },
        select: { name: true }
      }),
      
      // 黑名单项目数
      prisma.songBlacklist.count({
        where: { isActive: true }
      })
    ])

    // 计算变化百分比
    const requestsChange = previousWeekRequests > 0 
      ? Math.round(((weeklyRequests - previousWeekRequests) / previousWeekRequests) * 100)
      : weeklyRequests > 0 ? 100 : 0

    const songsChange = songsThisWeek - songsLastWeek
    const usersChange = usersThisWeek - usersLastWeek

    return {
      totalSongs,
      totalUsers,
      todaySchedules,
      totalSchedules,
      weeklyRequests,
      songsChange,
      usersChange,
      requestsChange,
      currentSemester: currentSemester?.name || null,
      blacklistCount
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取统计数据失败'
    })
  }
})
