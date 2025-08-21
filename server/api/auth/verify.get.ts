import { JWTEnhanced } from '../../utils/jwt-enhanced'
import { prisma } from '../../models/schema'

// 令牌验证端点
export default defineEventHandler(async (event) => {
  // 【安全修复】不依赖event.context.user，重新验证token并查询用户信息
  // 这样可以确保返回的是最新的、正确的用户信息，而不是可能被缓存的信息
  
  let token: string | null = null
  
  // 尝试从Authorization头部获取token
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }
  
  // 如果Authorization头部没有token，尝试从cookie获取
  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }
  
  if (!token) {
    throw createError({
      statusCode: 401,
      message: '未授权访问：缺少认证信息'
    })
  }
  
  try {
    // 重新验证token
    const decoded = JWTEnhanced.verifyToken(token)
    
    // 重新从数据库查询用户信息，确保数据的准确性
    let user
    try {
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
      const result = await prisma.$queryRaw`
        SELECT id, username, name, grade, class, role FROM "User" WHERE id = ${decoded.userId}
      `
      user = Array.isArray(result) && result.length > 0 ? result[0] : null
    }
    
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '用户不存在，请重新登录'
      })
    }
    
    // 返回用户完整信息
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      grade: user.grade,
      class: user.class,
      role: user.role,
      verified: true
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 401,
      message: 'Token无效，请重新登录'
    })
  }
})