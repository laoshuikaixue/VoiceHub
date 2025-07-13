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
    console.log(`未授权访问: ${path}, 没有提供令牌或格式不正确`)
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  const token = authHeader.substring(7) // 移除 'Bearer ' 前缀
  
  try {
    console.log(`验证令牌: ${path}`)
    
    // 检查JWT_SECRET是否设置
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET环境变量未设置')
      throw new Error('服务器配置错误：缺少JWT_SECRET')
    }
    
    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number,
      role: string,
      iat: number // 令牌发行时间
    }
    
    console.log(`令牌验证成功，用户ID: ${decoded.userId}, 角色: ${decoded.role}`)
    
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
          name: true,
          role: true
      }
    })
    } catch (schemaError) {
      console.warn('架构不匹配，使用原始SQL查询:', schemaError)
      
      // 如果Prisma模型失败，使用原始SQL查询
      const result = await prisma.$queryRaw`
        SELECT id, name, role FROM "User" WHERE id = ${decoded.userId}
      `
      
      user = Array.isArray(result) && result.length > 0 ? result[0] : null
    }
    
    if (!user) {
      console.log(`用户不存在: ${decoded.userId}`)
      throw createError({
        statusCode: 401,
        message: '用户不存在，请重新登录',
        data: { invalidToken: true }
      })
    }
    
    console.log(`用户验证成功: ${user.name}`)
    
    // 将用户信息添加到事件上下文
    event.context.user = {
      id: user.id,
      name: user.name,
      role: user.role
    }
  } catch (error) {
    // 详细记录JWT错误
    if (error instanceof jwt.JsonWebTokenError) {
      console.error(`JWT错误: ${error.name} - ${error.message}`)
      
      if (error.name === 'TokenExpiredError') {
        throw createError({
          statusCode: 401,
          message: '令牌已过期，请重新登录',
          data: { invalidToken: true }
        })
      } else if (error.name === 'NotBeforeError') {
        throw createError({
          statusCode: 401,
          message: '令牌尚未激活',
          data: { invalidToken: true }
        })
      } else {
        throw createError({
          statusCode: 401,
          message: '无效的令牌',
          data: { invalidToken: true }
        })
      }
    } else {
      console.error(`认证错误:`, error)
      throw createError({
        statusCode: 401,
        message: '认证失败: ' + (error instanceof Error ? error.message : '未知错误'),
        data: { invalidToken: true }
      })
    }
  }
}) 