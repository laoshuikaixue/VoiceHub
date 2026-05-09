import { db } from '~/drizzle/db'
import { users, systemSettings } from '~/drizzle/schema'
import { executeRedisCommand, isRedisReady } from '../../utils/redis'
import { CacheService } from '../../services/cacheService'
import { eq } from 'drizzle-orm'

// 用户认证缓存（永久缓存，登出或权限变更时主动失效）

export default defineEventHandler(async (event) => {
  try {
    const authUser = event.context.user
    if (!authUser) {
      throw createError({
        statusCode: 401,
        message: '未提供认证令牌'
      })
    }

    const userId = authUser.id

    // 查询系统设置判断是否启用首次登录强制改密（优先使用缓存，避免频繁查库）
    let forcePasswordChangeOnFirstLogin = true
    try {
      const cacheService = CacheService.getInstance()
      let cachedSettings = await cacheService.getSystemSettings()

      if (!cachedSettings) {
        // 缓存未命中，从数据库加载并写入缓存
        const settingsResult = await db.select().from(systemSettings).limit(1)
        if (settingsResult[0]) {
          cachedSettings = settingsResult[0]
          await cacheService.setSystemSettings(cachedSettings).catch(() => {})
        }
      }

      if (cachedSettings && typeof cachedSettings.forcePasswordChangeOnFirstLogin === 'boolean') {
        forcePasswordChangeOnFirstLogin = cachedSettings.forcePasswordChangeOnFirstLogin
      }
    } catch (e) {
      console.warn('[Auth] 读取系统设置失败，使用默认值 true:', e)
    }

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
        // 为缓存的用户数据添加字段
        const userWithDetails = {
          id: cachedUser.id,
          username: cachedUser.username,
          name: cachedUser.name,
          grade: cachedUser.grade,
          class: cachedUser.class,
          role: cachedUser.role,
          requirePasswordChange: !!cachedUser.forcePasswordChange || (forcePasswordChangeOnFirstLogin && !cachedUser.passwordChangedAt),
          has2FA: cachedUser.identities?.some((id: any) => id.provider === 'totp') || false,
          avatar: cachedUser.identities?.find((id: any) => id.provider === 'github')?.providerUsername
            ? `https://github.com/${cachedUser.identities.find((id: any) => id.provider === 'github').providerUsername}.png`
            : null
        }
        return {
          user: userWithDetails,
          valid: true
        }
      }
    }

    // 缓存未命中或Redis不可用，从数据库获取用户信息
    // 同时查询所有身份绑定信息
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
          }
        }
      }
    })

    const dbUser = userResult || null

    if (!dbUser) {
      throw createError({
        statusCode: 401,
        message: '用户不存在'
      })
    }

    // 构建返回的用户对象，只包含需要的字段
    const githubIdentity = dbUser.identities?.find((id: any) => id.provider === 'github')
    const user = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      grade: dbUser.grade,
      class: dbUser.class,
      role: dbUser.role,
      requirePasswordChange: !!dbUser.forcePasswordChange || (forcePasswordChangeOnFirstLogin && !dbUser.passwordChangedAt),
      has2FA: dbUser.identities?.some((id: any) => id.provider === 'totp') || false,
      // 动态生成 GitHub 头像 URL
      avatar: githubIdentity?.providerUsername
        ? `https://github.com/${githubIdentity.providerUsername}.png`
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
    throw error
  }
})
