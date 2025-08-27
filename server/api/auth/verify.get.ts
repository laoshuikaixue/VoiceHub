import jwt from 'jsonwebtoken'
import { prisma } from '../../models/schema'
import { isRedisReady, executeRedisCommand } from '../../utils/redis'
import { executeWithPool } from '../../utils/db-pool'

// 用户认证缓存（永久缓存，登出或权限变更时主动失效）

export default defineEventHandler(async (event) => {
  try {
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: '未提供认证令牌'
      })
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
    const userId = decoded.userId
    
    // 优先从Redis缓存获取用户认证状态
    if (isRedisReady()) {
      const cachedUser = await executeRedisCommand(async () => {
        const client = (await import('../../utils/redis')).getRedisClient()
        if (!client) return null
        
        const cacheKey = `user_auth:${userId}`
        const userData = await client.get(cacheKey)
        
        if (userData) {
          console.log(`[API] 用户认证缓存命中: ${userId}`)
          return JSON.parse(userData)
        }
        
        return null
      })
      
      if (cachedUser) {
        return {
          user: cachedUser,
          valid: true
        }
      }
    }
    
    // 缓存未命中或Redis不可用，从数据库获取用户信息
    const user = await executeWithPool(async () => {
      return await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          grade: true,
          class: true,
          role: true,
          isActive: true
        }
      })
    }, 'getUserAuth')

    if (!user || !user.isActive) {
      throw createError({
        statusCode: 401,
        statusMessage: '用户不存在或已被禁用'
      })
    }

    // 将用户认证状态缓存到Redis（如果可用）- 永久缓存
    if (isRedisReady()) {
      await executeRedisCommand(async () => {
        const client = (await import('../../utils/redis')).getRedisClient()
        if (!client) return
        
        const cacheKey = `user_auth:${userId}`
        await client.set(cacheKey, JSON.stringify(user))
        console.log(`[API] 用户认证状态已缓存: ${userId}`)
      })
    }

    return {
      user,
      valid: true
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw createError({
        statusCode: 401,
        statusMessage: '令牌无效或已过期'
      })
    }
    
    throw error
  }
})