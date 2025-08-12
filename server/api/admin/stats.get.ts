import { createError, defineEventHandler, getQuery } from 'h3'
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

  const query = getQuery(event)
  const semester = query.semester as string

  try {
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
      prisma.song.count({ where }),
      
      // 总用户数
      prisma.user.count(),
      
      // 今日排期数 (按天计算)
    (async () => {
      const todaySchedules = await prisma.schedule.findMany({
        where: todayScheduleWhere,
        select: { playDate: true }
      });
      
      // 按日期去重计算天数
      const uniqueDates = new Set(todaySchedules.map(s => s.playDate.toISOString().split('T')[0]));
      return uniqueDates.size;
    })(),
      
      // 总排期数 (按天计算)
    (async () => {
      const scheduleWhere = semester && semester !== 'all' ? { song: { semester: semester } } : {};
      const schedules = await prisma.schedule.findMany({
        where: scheduleWhere,
        select: { playDate: true }
      });
      
      // 按日期去重计算天数
      const uniqueDates = new Set(schedules.map(s => s.playDate.toISOString().split('T')[0]));
      return uniqueDates.size;
    })(),
      
      // 本周点歌数
      prisma.song.count({
        where: {
          ...where,
          createdAt: {
            gte: weekAgo
          }
        }
      }),
      
      // 上周点歌数
      prisma.song.count({
        where: {
          ...where,
          createdAt: {
            gte: twoWeeksAgo,
            lt: weekAgo
          }
        }
      }),
      
      // 本周新增歌曲
      prisma.song.count({
        where: {
          ...where,
          createdAt: {
            gte: weekAgo
          }
        }
      }),
      
      // 上周新增歌曲
      prisma.song.count({
        where: {
          ...where,
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

    // 获取趋势数据 (最近7天)
    const trendData = await Promise.all([
      // 歌曲趋势
      (async () => {
        const trends = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
          
          const count = await prisma.song.count({
            where: {
              ...where,
              createdAt: {
                gte: startOfDay,
                lt: endOfDay
              }
            }
          })
          
          trends.push({
            date: startOfDay.toISOString().split('T')[0],
            count
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
          
          const count = await prisma.user.count({
            where: {
              createdAt: {
                gte: startOfDay,
                lt: endOfDay
              }
            }
          })
          
          trends.push({
            date: startOfDay.toISOString().split('T')[0],
            count
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
          
          const schedules = await prisma.schedule.findMany({
            where: {
              ...scheduleBaseWhere,
              playDate: {
                gte: startOfDay,
                lt: endOfDay
              }
            },
            select: { playDate: true }
          })
          
          // 按日期去重计算天数
          const uniqueDates = new Set(schedules.map(s => s.playDate.toISOString().split('T')[0]))
          
          trends.push({
            date: startOfDay.toISOString().split('T')[0],
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
          
          const count = await prisma.song.count({
            where: {
              ...where,
              createdAt: {
                gte: startOfDay,
                lt: endOfDay
              }
            }
          })
          
          trends.push({
            date: startOfDay.toISOString().split('T')[0],
            count
          })
        }
        return trends
      })()
    ])

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
      blacklistCount,
      // 趋势数据
      songsTrend: trendData[0],
      usersTrend: trendData[1],
      schedulesTrend: trendData[2],
      requestsTrend: trendData[3]
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取统计数据失败'
    })
  }
})
