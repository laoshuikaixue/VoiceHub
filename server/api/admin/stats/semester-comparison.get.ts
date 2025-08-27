import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'

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
    // 获取所有学期
    const semesters = await prisma.semester.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 获取每个学期的统计数据
    const semesterStats = await Promise.all(
      semesters.map(async (semester) => {
        const songWhere = { semester: semester.name }
        
        // For schedules, we need to join with songs since Schedule model doesn't have semester field
        const [totalSongs, totalSchedules, totalRequests] = await Promise.all([
          prisma.song.count({ where: songWhere }),
          prisma.schedule.count({
            where: {
              song: songWhere
            }
          }),
          prisma.song.count({ 
            where: { 
              ...songWhere, 
              votes: {
                some: {}
              }
            } 
          })
        ])
        
        return {
          semester: semester.name,
          totalSongs,
          totalSchedules,
          totalRequests,
          isActive: semester.isActive
        }
      })
    )

    return semesterStats
  } catch (error) {
    console.error('获取学期对比数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取学期对比数据失败'
    })
  }
})