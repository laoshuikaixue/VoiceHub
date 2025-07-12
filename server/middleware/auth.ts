import jwt from 'jsonwebtoken'
import { prisma } from '../models/schema'

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)
  
  // 无需认证的公共路径
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/songs/public',
    '/',
    '/login',
    '/register',
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
      message: '未授权访问'
    })
  }
  
  const token = authHeader.substring(7) // 移除 'Bearer ' 前缀
  
  try {
    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number,
      role: string
    }
    
    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId
      }
    })
    
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '用户不存在'
      })
    }
    
    // 将用户信息添加到事件上下文
    event.context.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      message: '无效的令牌'
    })
  }
}) 