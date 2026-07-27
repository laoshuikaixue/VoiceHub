import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  try {
    const authUser = event.context.user
    if (!authUser) {
      throw createApiError(401, 'AUTH_TOKEN_MISSING', '未提供认证令牌')
    }

    const userId = authUser.id

    // 用户资料始终从数据库获取，避免权限和绑定状态缓存过期。
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
        passwordChangedAt: true,
        avatar: true
      },
      with: {
        identities: {
          columns: {
            provider: true,
            providerUsername: true,
            providerAvatar: true
          }
        }
      }
    })

    const dbUser = userResult || null

    if (!dbUser) {
      throw createApiError(401, 'USER_NOT_FOUND', '用户不存在')
    }

    // 头像优先级：用户自定义头像 > 任意已绑定 provider 提供的最新头像 > null
    const providerAvatar = dbUser.identities
      ?.map((id: any) => id.providerAvatar)
      .find((avatar: string | null | undefined) => Boolean(avatar))
    const user = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      grade: dbUser.grade,
      class: dbUser.class,
      role: dbUser.role,
      requirePasswordChange: dbUser.forcePasswordChange || !dbUser.passwordChangedAt,
      has2FA: dbUser.identities?.some((id: any) => id.provider === 'totp') || false,
      avatar: dbUser.avatar || providerAvatar || null
    }

    return {
      user,
      valid: true
    }
  } catch (error) {
    throw error
  }
})
