import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '未授权'
      })
    }

    // 获取最新的用户信息
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        name: true,
        grade: true,
        class: true,
        role: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!currentUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 返回用户信息，包含needsPasswordChange字段
    return {
      ...currentUser,
      needsPasswordChange: !currentUser.passwordChangedAt
    }
  } catch (error: any) {
    console.error('获取用户信息错误:', error)
    
    // 如果是已经格式化的错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 否则创建一个通用的服务器错误
    throw createError({
      statusCode: 500,
      message: '获取用户信息失败'
    })
  }
})