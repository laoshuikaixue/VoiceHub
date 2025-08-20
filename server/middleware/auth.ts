import { JWTEnhanced } from '../utils/jwt-enhanced'
import { prisma } from '../models/schema'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // 只对API路径进行认证检查，前端页面路径直接跳过
  if (!pathname.startsWith('/api/')) {
    return
  }

  // 公共API路径，不需要认证
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/semesters/current',
    '/api/play-times',
    '/api/schedules/public',
    '/api/songs/count',
    '/api/songs/public',
    '/api/upload',
    '/api/site-config'
  ]

  // 检查是否为公共API路径或歌曲相关路径
  const isPublicApiPath = publicApiPaths.some(path => pathname.startsWith(path)) ||
                          /^\/api\/songs\/\d+/.test(pathname)

  if (isPublicApiPath) {
    return
  }
  
  // 获取认证令牌 - 优先从cookie获取，其次从Authorization header
  let token = getCookie(event, 'auth-token')
  
  if (!token) {
    const authHeader = getRequestHeader(event, 'authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7) // 移除 'Bearer ' 前缀
    }
  }
  
  if (!token) {
    throw createError({
      statusCode: 401,
      message: '未授权访问',
      data: { invalidToken: true }
    })
  }
  
  try {
    // 获取用户代理信息用于验证
    const userAgent = getRequestHeader(event, 'user-agent') || 'Unknown'
    
    // 使用增强的JWT验证
    const decoded = JWTEnhanced.verifyToken(token, userAgent)
    
    console.log('Token解码成功:', { userId: decoded.userId, role: decoded.role, pathname })
    
    // 获取用户信息
    let user
    try {
      // 尝试使用Prisma模型
      user = await prisma.user.findUnique({
      where: {
        id: decoded.userId
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true
      }
    })
    } catch (schemaError) {
      // 如果Prisma模型失败，使用原始SQL查询
      const result = await prisma.$queryRaw`
        SELECT id, username, name, role FROM "User" WHERE id = ${decoded.userId}
      `
      
      user = Array.isArray(result) && result.length > 0 ? result[0] : null
    }
    
    if (!user) {
      console.log('用户查询失败:', { userId: decoded.userId })
      throw createError({
        statusCode: 401,
        message: '用户不存在，请重新登录',
        data: { invalidToken: true }
      })
    }
    
    console.log('用户查询成功:', { id: user.id, username: user.username, role: user.role })
    
    // 将用户信息添加到事件上下文
    event.context.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      sessionId: decoded.sessionId,
      tokenType: decoded.tokenType
    }
    
    // 检查token是否即将过期（剩余时间少于5分钟）
    if (decoded.tokenType === 'access' && JWTEnhanced.isTokenExpiringSoon(token, 5 * 60)) {
      // 设置响应头提示前端刷新token
      setResponseHeader(event, 'X-Token-Refresh-Needed', 'true')
    }
      
    // 检查管理员路径权限
    if (pathname.startsWith('/api/admin') && !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
        console.log('权限检查失败:', { pathname, userRole: user.role, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'] })
        throw createError({
        statusCode: 403,
        message: '需要管理员权限',
      })
    }
    
  } catch (error: any) {
    console.warn('Token verification failed:', error.message)
    
    // 如果是access token过期，尝试使用refresh token
    if (error.message?.includes('过期') || error.message?.includes('expired')) {
      const refreshToken = getCookie(event, 'refresh-token')
      
      if (refreshToken) {
        try {
          const userAgent = getRequestHeader(event, 'user-agent') || 'Unknown'
          const newTokenPair = JWTEnhanced.refreshAccessToken(refreshToken, userAgent)
          
          // 设置新的access token cookie
          setCookie(event, 'auth-token', newTokenPair.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60, // 15分钟
            path: '/'
          })
          
          // 验证新token并设置用户上下文
          const decoded = JWTEnhanced.verifyToken(newTokenPair.accessToken, userAgent)
          
          // 获取用户信息
          let user
          try {
            user = await prisma.user.findUnique({
              where: { id: decoded.userId },
              select: {
                id: true,
                username: true,
                name: true,
                role: true
              }
            })
          } catch (schemaError) {
            const result = await prisma.$queryRaw`
              SELECT id, username, name, role FROM "User" WHERE id = ${decoded.userId}
            `
            user = Array.isArray(result) && result.length > 0 ? result[0] : null
          }
          
          if (!user) {
            throw createError({
              statusCode: 401,
              message: '用户不存在，请重新登录',
              data: { invalidToken: true }
            })
          }
          
          event.context.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            sessionId: decoded.sessionId,
            tokenType: decoded.tokenType
          }
          
          // 设置响应头表示token已刷新
          setResponseHeader(event, 'X-Token-Refreshed', 'true')
          
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError)
          throw createError({
            statusCode: 401,
            message: 'Token无效或已过期，请重新登录',
            data: { invalidToken: true }
          })
        }
      } else {
        throw createError({
          statusCode: 401,
          message: 'Token已过期，请重新登录',
          data: { invalidToken: true }
        })
      }
    } else {
      // 如果是我们自己抛出的错误，直接重新抛出
      if (error.statusCode) {
        throw error
      }
      
      // 其他未知错误
      throw createError({
        statusCode: 401,
        message: 'Token无效',
        data: { invalidToken: true }
      })
    }
  }
})