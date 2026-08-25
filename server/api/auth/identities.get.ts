import { db, eq, userIdentities } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { getIdentityAvatarUrl } from '~~/server/utils/user-avatar'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      avatarProvider: true,
      avatarProviderUserId: true
    }
  })

  const identities = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, user.id),
    columns: {
      id: true, // 需要 id 以便单独删除
      provider: true,
      providerUserId: true,
      providerUsername: true,
      avatar: true,
      createdAt: true
    }
  })

  return identities.map(identity => {
    if (identity.provider === 'webauthn') {
      try {
        const data = JSON.parse(identity.providerUsername)
        return {
          ...identity,
          providerUsername: data.label || 'WebAuthn 设备',
          avatar: null,
          isAvatarSource: false
          // 可以在这里把 label 改为 userFriendlyName
        }
      } catch {
        return {
          ...identity,
          providerUsername: '未知设备',
          avatar: null,
          isAvatarSource: false
        }
      }
    }
    if (identity.provider === 'totp') {
      return {
        ...identity,
        avatar: null,
        isAvatarSource: false
      }
    }
    const isAvatarSource =
      userRecord?.avatarProvider === identity.provider &&
      userRecord?.avatarProviderUserId === identity.providerUserId
    return {
      ...identity,
      avatar: getIdentityAvatarUrl(identity),
      isAvatarSource
    }
  })
})
