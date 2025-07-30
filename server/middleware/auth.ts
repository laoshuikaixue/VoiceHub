import jwt from 'jsonwebtoken'
import { prisma } from '../models/schema'

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)
  
  // 无需认证的公共路径
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/songs/public',
    '/api/songs/count',
    '/api/semesters/current',
    '/api/play-times',
    '/',
    '/login',
    '/register',
    '/notifications',
    '/favicon.ico',
    '/_nuxt'
  ]
  
  // 检查是否是公共路径或以公共路径开头
  const isPublicPath = publicRoutes.some(route => 
    path === route || path.startsWith(route + '/') || path.startsWith('/_nuxt/')
  )
  
  if (isPublicPath) {
    return
  }
  
  // 获取认证令牌
  const authHeader = getRequestHeader(event, 'authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: '未授权访问',
      data: { invalidToken: true }
    })
  }
  
  const token = authHeader.substring(7) // 移除 'Bearer ' 前缀
  
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
    
    console.log('Token解码成功:', { userId: decoded.userId, role: decoded.role, path })
    
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
    if (path.startsWith('/api/admin') && !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
        console.log('权限检查失败:', { path, userRole: user.role, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'] })
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