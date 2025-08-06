import { createError, defineEventHandler, getQuery } from 'h3'
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

  const query = getQuery(event)
  const semester = query.semester as string

  try {
    // 构建查询条件
    const where = semester && semester !== 'all' ? { semester: semester } : {}

    // 获取最近30天的歌曲点播趋势
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const trendData = await prisma.song.groupBy({
      by: ['createdAt'],
      where: {
        ...where,
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      _count: {
        _all: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // 格式化数据
    const formattedData = trendData.map(item => ({
      date: item.createdAt.toISOString().split('T')[0],
      count: item._count._all
    }))

    return formattedData
  } catch (error) {
    console.error('获取趋势数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取趋势数据失败'
    })
  }
})