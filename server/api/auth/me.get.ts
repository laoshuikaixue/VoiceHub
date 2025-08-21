import { prisma } from '../../models/schema'
import { JWTEnhanced } from '../../utils/jwt-enhanced'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证中间件是否已经验证用户
    const user = event.context.user
    if (!user) {
      console.warn('[Auth API] No user context found')
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
        updatedAt: true,
        lastLogin: true,
        lastLoginIp: true
      }
    })

    if (!currentUser) {
      console.error(`[Auth API] User ${user.id} not found in database`)
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 验证用户基本信息的一致性
    if (currentUser.username !== user.username || currentUser.role !== user.role) {
      console.error(`[Auth API] User data inconsistency for ${user.id}: DB(${currentUser.username}/${currentUser.role}) vs Context(${user.username}/${user.role})`)
      throw createError({
        statusCode: 401,
        message: '用户信息不一致，请重新登录'
      })
    }

    console.log(`[Auth API] Successfully validated user ${currentUser.id} (${currentUser.username})`)

    // 返回用户信息
    return {
      ...currentUser,
      needsPasswordChange: !currentUser.passwordChangedAt,
      _validatedAt: Date.now(),
      _userId: currentUser.id
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