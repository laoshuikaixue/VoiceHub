import { JWTEnhanced } from '../../utils/jwt-enhanced'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 验证用户令牌并返回用户信息

  let token: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }

  if (!token) {
    return sendError(event, createError({
      statusCode: 401,
      message: '未授权访问：缺少认证信息'
    }))
  }

  try {
    const decoded = JWTEnhanced.verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        name: true,
        grade: true,
        class: true,
        role: true,
        forcePasswordChange: true,
        passwordChangedAt: true
      }
    })

    if (!user) {
      return sendError(event, createError({
        statusCode: 401,
        message: '用户不存在，请重新登录'
      }))
    }

    // 返回用户数据
    return { user }

  } catch (error: any) {
    return sendError(event, createError({
      statusCode: 401,
      message: `认证失败: ${error.message}`,
      data: { invalidToken: true }
    }))
  }
})