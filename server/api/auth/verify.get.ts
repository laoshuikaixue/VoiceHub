import type { User } from '~~/types/index'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { resolveRequirePasswordChange } from '~~/server/utils/system-settings-helper'
import { getPasswordSetupState } from '~~/server/utils/initial-password-policy'

export default defineEventHandler(async (event) => {
  const authUser = event.context.user
  if (!authUser) {
    throw createError({ statusCode: 401, message: '未提供认证令牌' })
  }

  // 用户资料始终从数据库获取，避免权限、绑定和强制改密状态过期。
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, authUser.id),
    columns: {
      id: true,
      username: true,
      name: true,
      grade: true,
      class: true,
      role: true,
      email: true,
      emailVerified: true,
      password: true,
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

  if (!dbUser) {
    throw createError({ statusCode: 401, message: '用户不存在' })
  }

  const requirePasswordChange = await resolveRequirePasswordChange(dbUser)
  const passwordSetupState = getPasswordSetupState(dbUser, requirePasswordChange)
  const githubIdentity = dbUser.identities.find((identity) => identity.provider === 'github')
  const user = {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    grade: dbUser.grade,
    class: dbUser.class,
    role: dbUser.role,
    email: dbUser.email,
    emailVerified: dbUser.emailVerified,
    forcePasswordChange: dbUser.forcePasswordChange,
    passwordChangedAt: dbUser.passwordChangedAt,
    requirePasswordChange,
    ...passwordSetupState,
    has2FA: dbUser.identities.some((identity) => identity.provider === 'totp'),
    avatar: githubIdentity?.providerUsername
      ? `https://github.com/${githubIdentity.providerUsername}.png`
      : null
  } as User

  return { user, valid: true }
})
