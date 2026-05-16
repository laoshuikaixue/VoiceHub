import { db } from '~/drizzle/db'
import { userIdentities } from '~/drizzle/schema'
import { executeRedisCommand, isRedisReady } from '../../utils/redis'
import { eq } from 'drizzle-orm'

// 用户认证缓存（永久缓存，登出或权限变更时主动失效）

export default defineEventHandler(async (event) => {
  try {
    // event.context.user 已由 server/middleware/auth.ts 填充基础字段 + requirePasswordChange + hasSetPassword
    const authUser = event.context.user
    if (!authUser) {
      throw createError({
        statusCode: 401,
        message: '未提供认证令牌'
      })
    }

    const userId = authUser.id

    // 优先从Redis缓存获取 identities 信息
    let identities: { provider: string; providerUsername: string | null }[] = []
    let identitiesCached = false

    if (isRedisReady()) {
      const cached = await executeRedisCommand(async () => {
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

      if (cached?.identities) {
        identities = cached.identities
        identitiesCached = true
      }
    }

    // 缓存未命中时仅查询 identities 关联表（基础用户信息已由中间件提供）
    if (!identitiesCached) {
      const identitiesResult = await db
        .select({
          provider: userIdentities.provider,
          providerUsername: userIdentities.providerUsername
        })
        .from(userIdentities)
        .where(eq(userIdentities.userId, userId))

      identities = identitiesResult

      // 将 identities 缓存到 Redis
      if (isRedisReady()) {
        await executeRedisCommand(async () => {
          const client = (await import('../../utils/redis')).getRedisClient()
          if (!client) return

          const cacheKey = `auth:user:${userId}`
          await client.set(cacheKey, JSON.stringify({ ...authUser, identities }), 'EX', 86400)
          console.log(`[API] 用户认证状态已缓存: ${userId}`)
        })
      }
    }

    const githubIdentity = identities.find((id) => id.provider === 'github')
    const user = {
      id: authUser.id,
      username: authUser.username,
      name: authUser.name,
      grade: authUser.grade,
      class: authUser.class,
      role: authUser.role,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      requirePasswordChange: authUser.requirePasswordChange,
      hasSetPassword: authUser.hasSetPassword,
      forcePasswordChange: authUser.forcePasswordChange,
      passwordChangedAt: authUser.passwordChangedAt,
      has2FA: identities.some((id) => id.provider === 'totp'),
      avatar: githubIdentity?.providerUsername
        ? `https://github.com/${githubIdentity.providerUsername}.png`
        : null
    }

    return {
      user,
      valid: true
    }
  } catch (error) {
    throw error
  }
})
