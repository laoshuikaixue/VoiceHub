import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理播出时段'
    })
  }
  
  try {
    // 获取所有播出时段
    const playTimes = await prisma.playTime.findMany({
      orderBy: [
        { enabled: 'desc' }, // 启用的排在前面
        { startTime: 'asc' } // 按开始时间排序
      ]
    })
    
    return playTimes
  } catch (error) {
    console.error('获取播出时段失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取播出时段失败'
    })
  }
}) 