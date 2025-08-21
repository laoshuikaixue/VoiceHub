import { JWTEnhanced } from '../utils/jwt-enhanced'
import { prisma } from '../models/schema'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // 【安全修复】确保每个请求都有独立的用户上下文，防止在无服务器环境中的上下文共享
  // 在每个请求开始时明确清除用户上下文
  event.context.user = null

  // 只对API路径进行认证检查，前端页面路径直接跳过
  if (!pathname.startsWith('/api/')) {
    return
  }

  // 公共API路径，不需要认证
  const publicApiPaths = [
    '/api/auth/login',
    '/api/semesters/current',
    '/api/play-times',
    '/api/schedules/public',
    '/api/songs/count',
    '/api/songs/public',
    '/api/site-config'
  ]

  // 检查是否为公共API路径
  const isPublicApiPath = publicApiPaths.some(path => pathname.startsWith(path))

  // 如果是公共API路径，确保用户上下文为空
  if (isPublicApiPath) {
    event.context.user = null
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
    // 【安全修复】明确清除用户上下文
    event.context.user = null
    throw createError({
      statusCode: 401,
      message: '未授权访问：缺少有效的认证信息',
      data: { invalidToken: true }
    })
  }

  try {
    // 使用简化的JWT验证
    const decoded = JWTEnhanced.verifyToken(token)

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
      // 【安全修复】明确清除用户上下文
      event.context.user = null
      throw createError({
        statusCode: 401,
        message: '用户不存在，请重新登录',
        data: { invalidToken: true }
      })
    }

    // 【安全修复】明确设置用户信息到事件上下文，确保是全新的对象
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
      // 【安全修复】权限不足时清除用户上下文
      event.context.user = null
      throw createError({
        statusCode: 403,
        message: '需要管理员权限'
      })
    }
  } catch (error: any) {
    // 【安全修复】任何认证失败都要明确清除用户上下文
    event.context.user = null

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