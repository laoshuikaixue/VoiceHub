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
      throw createApiError(401, 'USER_NOT_FOUND', '用户不存在')
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
      requirePasswordChange: dbUser.forcePasswordChange || !dbUser.passwordChangedAt,
      has2FA: dbUser.identities?.some((id: any) => id.provider === 'totp') || false,
      // 动态生成 GitHub 头像 URL
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
