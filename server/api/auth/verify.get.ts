import { JWTEnhanced } from '../../utils/jwt-enhanced'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // This endpoint verifies the user's token and returns user information.
  // It is designed to be stateless and does not rely on event.context.user.

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
        role: true
      }
    })

    if (!user) {
      return sendError(event, createError({
        statusCode: 401,
        message: '用户不存在，请重新登录'
      }))
    }

    // Return user data directly
    return { user }

  } catch (error: any) {
    return sendError(event, createError({
      statusCode: 401,
      message: `认证失败: ${error.message}`,
      data: { invalidToken: true }
    }))
  }
})