import { db, eq, and, users, userIdentities } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { getIdentityAvatarUrl } from '~~/server/utils/user-avatar'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const body = await readBody(event)
  const identityId = Number(body?.identityId)
  if (!Number.isInteger(identityId) || identityId <= 0) {
    throw createApiError(400, 'COMMON_INVALID_PARAMS', '参数错误')
  }

  const identity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.id, identityId), eq(userIdentities.userId, user.id)),
    columns: {
      provider: true,
      providerUserId: true,
      providerUsername: true,
      avatar: true
    }
  })

  const avatarUrl = getIdentityAvatarUrl(identity)
  if (!identity || !avatarUrl) {
    throw createApiError(400, 'COMMON_INVALID_PARAMS', '该身份没有可用的头像')
  }

  await db
    .update(users)
    .set({
      avatarProvider: identity.provider,
      avatarProviderUserId: identity.providerUserId
    })
    .where(eq(users.id, user.id))

  return { success: true, avatar: avatarUrl }
})
