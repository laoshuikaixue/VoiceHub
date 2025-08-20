import jwt from 'jsonwebtoken'
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
    // 检查JWT_SECRET是否设置
    if (!process.env.JWT_SECRET) {
      throw new Error('服务器配置错误：缺少JWT_SECRET')
    }
    
    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number,
      role: string,
      iat: number // 令牌发行时间
    }
    
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
      role: user.role
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
    // 检查是否是JWT验证错误
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw createError({
        statusCode: 401,
        message: '无效或过期的令牌',
        data: { invalidToken: true }
      })
    }
    
    // 如果是我们自己抛出的错误，直接重新抛出
    if (error.statusCode) {
      throw error
    }
    
    // 其他未知错误
    throw createError({
      statusCode: 500,
      message: '服务器认证错误',
    })
  }
})