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
    '/api/semesters/current',
    '/api/play-times',
    '/api/schedules/public',
    '/api/songs',
    '/api/upload',
    '/api/site-config'
  ]

  // 需要认证的特定API路径（即使在公共路径下）
  const authRequiredPaths = [
    '/api/songs/submission-status',
    '/api/songs/vote'
  ]

  // 检查是否需要强制认证
  const requiresAuth = authRequiredPaths.some(path => pathname.startsWith(path))
  
  // 检查是否为公共API路径或特定歌曲详情路径
  const isPublicApiPath = publicApiPaths.some(path => pathname.startsWith(path)) ||
                          /^\/api\/songs\/\d+$/.test(pathname)

  // 如果不需要强制认证且是公共API路径，则跳过认证
  if (!requiresAuth && isPublicApiPath) {
    return
  }
  
  // 尝试从Authorization头部或cookie获取token
  let token: string | null = null
  
  // 首先尝试从Authorization头部获取
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7) // 移除 'Bearer ' 前缀
  }
  
  // 如果Authorization头部没有token，尝试从cookie获取
  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }
  
  if (!token) {
    throw createError({
      statusCode: 401,
      message: '未授权访问：缺少有效的认证信息',
      data: { invalidToken: true }
    })
  }
  
  try {
    // 使用简化的JWT验证
    const decoded = JWTEnhanced.verifyToken(token)
    
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
          grade: true,
          class: true,
          role: true
        }
      })
    } catch (schemaError) {
      // 如果Prisma模型失败，使用原始SQL查询
      const result = await prisma.$queryRaw`
        SELECT id, username, name, grade, class, role FROM "User" WHERE id = ${decoded.userId}
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
      grade: user.grade,
      class: user.class,
      role: user.role
    }
      
    // 检查管理员路径权限
    if (pathname.startsWith('/api/admin') && !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
      console.log('权限检查失败:', { pathname, userRole: user.role, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'] })
      throw createError({
        statusCode: 403,
        message: '需要管理员权限'
      })
    }
    
  } catch (error: any) {
    console.warn('Token verification failed:', error.message)
    
    // 如果是我们自己抛出的错误，直接重新抛出
    if (error.statusCode) {
      throw error
    }
    
    // JWT验证失败的错误处理
    if (error.message?.includes('expired') || error.message?.includes('过期')) {
      throw createError({
        statusCode: 401,
        message: 'Token已过期，请重新登录',
        data: { invalidToken: true }
      })
    }
    
    if (error.message?.includes('signature') || error.message?.includes('签名')) {
      throw createError({
        statusCode: 401,
        message: 'Token签名无效，请重新登录',
        data: { invalidToken: true }
      })
    }
    
    // 其他JWT验证错误
    throw createError({
      statusCode: 401,
      message: 'Token无效，请重新登录',
      data: { invalidToken: true }
    })
  }
})