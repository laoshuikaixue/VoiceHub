import type { User } from '~~/types/index'
import { db } from '~/drizzle/db'
import { userIdentities } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { userCache } from '~~/server/utils/cache-helpers'

export default defineEventHandler(async (event) => {
  const authUser = event.context.user
  if (!authUser) {
    throw createError({ statusCode: 401, message: '未提供认证令牌' })
  }

  const userId = authUser.id
  let identities: Array<{ provider: string; providerUsername: string | null }> = []
  const cached = (await userCache.getAuth(String(userId))) as {
    identities?: Array<{ provider: string; providerUsername: string | null }>
  } | null

  if (cached?.identities) {
    identities = cached.identities
  } else {
    identities = await db
      .select({
        provider: userIdentities.provider,
        providerUsername: userIdentities.providerUsername
      })
      .from(userIdentities)
      .where(eq(userIdentities.userId, userId))

    await userCache.setAuth(String(userId), { ...authUser, identities })
  }

  const githubIdentity = identities.find((identity) => identity.provider === 'github')
  const user = {
    id: authUser.id,
    username: authUser.username,
    name: authUser.name,
    grade: authUser.grade,
    class: authUser.class,
    role: authUser.role,
    email: authUser.email,
    emailVerified: authUser.emailVerified,
    forcePasswordChange: authUser.forcePasswordChange,
    passwordChangedAt: authUser.passwordChangedAt,
    requirePasswordChange: authUser.requirePasswordChange,
    hasSetPassword: authUser.hasSetPassword,
    needsInitialPasswordSetup: authUser.needsInitialPasswordSetup,
    has2FA: identities.some((identity) => identity.provider === 'totp'),
    avatar: githubIdentity?.providerUsername
      ? `https://github.com/${githubIdentity.providerUsername}.png`
      : null
  } as User

  return { user, valid: true }
})
