import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  try {
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        lastLoginAt: true,
        lastLoginIp: true
      },
      orderBy: {
        id: 'asc'
      }
    })

    return users
  } catch (error) {
    console.error('获取用户列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取用户列表失败'
    })
  }
}) 