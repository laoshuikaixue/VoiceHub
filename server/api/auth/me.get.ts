import { prisma } from '../../models/schema'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证
    const user = event.context.user
    if (!user) {
      console.warn('[Auth API] No user context found')
      throw createError({
        statusCode: 401,
        message: '未授权'
      })
    }

    // 额外的JWT token验证（双重验证）
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    if (!token) {
      console.warn(`[Auth API] No token found for user ${user.id}`)
      throw createError({
        statusCode: 401,
        message: '缺少认证令牌'
      })
    }

    // 验证token的有效性和用户ID一致性
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number, iat: number }
      
      // 检查token中的用户ID是否与context中的一致
      if (decoded.userId !== user.id) {
        console.error(`[Auth API] Token user ID mismatch: token=${decoded.userId}, context=${user.id}`)
        throw createError({
          statusCode: 401,
          message: '令牌用户身份不匹配'
        })
      }
      
      // 检查token是否过期（24小时）
      const tokenAge = Date.now() - (decoded.iat * 1000)
      if (tokenAge > 24 * 60 * 60 * 1000) {
        console.warn(`[Auth API] Token expired for user ${user.id}, age: ${tokenAge}ms`)
        throw createError({
          statusCode: 401,
          message: '令牌已过期'
        })
      }
    } catch (jwtError: any) {
      console.error(`[Auth API] JWT verification failed for user ${user.id}:`, jwtError.message)
      throw createError({
        statusCode: 401,
        message: '令牌验证失败'
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

    // 返回用户信息，包含needsPasswordChange字段和验证时间戳
    return {
      ...currentUser,
      needsPasswordChange: !currentUser.passwordChangedAt,
      _validatedAt: Date.now(), // 添加验证时间戳
      _userId: currentUser.id // 添加用户ID用于客户端验证
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