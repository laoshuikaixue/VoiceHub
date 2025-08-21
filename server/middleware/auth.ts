import { JWTEnhanced } from '../utils/jwt-enhanced'
import { prisma } from '../models/schema'

export default defineEventHandler(async (event) => {
  // Aggressively clear user context at the start of every request
  if (event.context.user) {
    delete event.context.user
  }

  const url = getRequestURL(event)
  const pathname = url.pathname

  // Skip middleware for non-API routes
  if (!pathname.startsWith('/api/')) {
    return
  }

  // Define public API paths that do not require authentication
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/verify', // The verify endpoint handles its own token validation
    '/api/semesters/current',
    '/api/play-times',
    '/api/schedules/public',
    '/api/songs/count',
    '/api/songs/public',
    '/api/site-config'
  ]

  // If the path is public, do not proceed with authentication checks
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return
  }

  // For protected routes, get the token from header or cookie
  let token: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }

  // If no token is found for a protected route, send a 401 error
  if (!token) {
    return sendError(event, createError({
      statusCode: 401,
      message: '未授权访问：缺少有效的认证信息'
    }))
  }

  try {
    // Verify the token and fetch the user from the database
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

    // If user not found, the token is invalid
    if (!user) {
      return sendError(event, createError({
        statusCode: 401,
        message: '用户不存在，请重新登录'
      }))
    }

    // Attach user information to the request context
    event.context.user = user

    // Check for admin-only routes
    if (pathname.startsWith('/api/admin') && !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
      return sendError(event, createError({
        statusCode: 403,
        message: '需要管理员权限'
      }))
    }
  } catch (error: any) {
    // Handle JWT verification errors (e.g., expired, invalid signature)
    return sendError(event, createError({
      statusCode: 401,
      message: `认证失败: ${error.message}`,
      data: { invalidToken: true }
    }))
  }
})