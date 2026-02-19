import jwt from 'jsonwebtoken'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { executeRedisCommand, isRedisReady } from '../../utils/redis'
import { eq } from 'drizzle-orm'

// 用户认证缓存（永久缓存，登出或权限变更时主动失效）

export default defineEventHandler(async (event) => {
  try {
    const token =
      getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')

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

        const cacheKey = `auth:user:${userId}`
        const userData = await client.get(cacheKey)

        if (userData) {
          console.log(`[API] 用户认证缓存命中: ${userId}`)
          return JSON.parse(userData)
        }

        return null
      })

      if (cachedUser) {
        // 为缓存的用户数据添加requirePasswordChange字段
        const userWithRequirePasswordChange = {
          id: cachedUser.id,
          username: cachedUser.username,
          name: cachedUser.name,
          grade: cachedUser.grade,
          class: cachedUser.class,
          role: cachedUser.role,
          requirePasswordChange: cachedUser.forcePasswordChange || !cachedUser.passwordChangedAt
        }
        return {
          user: userWithRequirePasswordChange,
          valid: true
        }
      }
    }

    // 缓存未命中或Redis不可用，从数据库获取用户信息
    // 同时查询 OAuth 绑定信息以获取 GitHub 头像
    const userResult = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        username: true,
        name: true,
        grade: true,
        class: true,
        role: true,
        forcePasswordChange: true,
        passwordChangedAt: true
      },
      with: {
        identities: {
          columns: {
            provider: true,
            providerUsername: true
          },
          where: (identities, { eq }) => eq(identities.provider, 'github')
        }
      }
    })

    const dbUser = userResult || null

    if (!dbUser) {
      throw createError({
        statusCode: 401,
        statusMessage: '用户不存在'
      })
    }

    // 构建返回的用户对象，只包含需要的字段
    const user = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      grade: dbUser.grade,
      class: dbUser.class,
      role: dbUser.role,
      requirePasswordChange: dbUser.forcePasswordChange || !dbUser.passwordChangedAt,
      // 动态生成 GitHub 头像 URL
      avatar: dbUser.identities?.[0]?.providerUsername
        ? `https://github.com/${dbUser.identities[0].providerUsername}.png`
        : null
    }

    // 将用户认证状态缓存到Redis（如果可用）- 永久缓存
    if (isRedisReady()) {
      await executeRedisCommand(async () => {
        const client = (await import('../../utils/redis')).getRedisClient()
        if (!client) return

        const cacheKey = `auth:user:${userId}`
        // 缓存完整的数据库用户信息，用于后续验证
        await client.set(cacheKey, JSON.stringify(dbUser))
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
