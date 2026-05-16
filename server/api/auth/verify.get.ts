import { db } from '~/drizzle/db'
import { userIdentities } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { userCache } from '~~/server/utils/cache-helpers'

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

    // 优先从缓存获取 identities 信息
    let identities: { provider: string; providerUsername: string | null }[] = []
    let identitiesCached = false

    const cached = await userCache.getAuth(String(userId)) as (User & { identities: any[] }) | null
    if (cached?.identities) {
      identities = cached.identities
      identitiesCached = true
    }

    // 缓存未命中时查询 identities 关联表（基础用户信息已由中间件提供）
    if (!identitiesCached) {
      const identitiesResult = await db
        .select({
          provider: userIdentities.provider,
          providerUsername: userIdentities.providerUsername
        })
        .from(userIdentities)
        .where(eq(userIdentities.userId, userId))

      identities = identitiesResult

      // 将完整用户数据写入缓存
      await userCache.setAuth(String(userId), { ...authUser, identities })
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
