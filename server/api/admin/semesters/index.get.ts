import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能访问'
    })
  }
  
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理学期'
    })
  }
  
  try {
    // 获取所有学期，按创建时间倒序排列
    const semesters = await prisma.semester.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return semesters
  } catch (error: any) {
    console.error('获取学期列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取学期列表失败'
    })
  }
})
