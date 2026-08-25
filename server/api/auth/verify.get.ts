import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { resolveRequirePasswordChange } from '~~/server/utils/system-settings-helper'
import { getPasswordSetupState } from '~~/server/utils/initial-password-policy'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'

export default defineEventHandler(async (event) => {
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
      password: true,
      forcePasswordChange: true,
      passwordChangedAt: true,
      avatarProvider: true,
      avatarProviderUserId: true
    },
    with: {
      identities: {
        columns: {
          provider: true,
          providerUsername: true,
          providerUserId: true,
          avatar: true,
          createdAt: true
        }
      }
    }
  })

  const dbUser = userResult || null

  if (!dbUser) {
    throw createApiError(401, 'USER_NOT_FOUND', '用户不存在')
  }

  // 与登录接口保持一致：按系统开关与用户状态计算强制改密及首次设置密码状态
  const requirePasswordChange = await resolveRequirePasswordChange(dbUser)
  const passwordSetupState = getPasswordSetupState(dbUser, requirePasswordChange)

  // 构建返回的用户对象，只包含需要的字段
  const avatarSource = resolveAvatarSource(dbUser, dbUser.identities || [])
  const user = {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    grade: dbUser.grade,
    class: dbUser.class,
    role: dbUser.role,
    forcePasswordChange: dbUser.forcePasswordChange,
    passwordChangedAt: dbUser.passwordChangedAt,
    requirePasswordChange,
    ...passwordSetupState,
    has2FA: dbUser.identities?.some((id: any) => id.provider === 'totp') || false,
    avatar: avatarSource?.url ?? null
  }

  return {
    user,
    valid: true
  }
})
