import { db, eq, and, userIdentities } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const identities = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, user.id),
    columns: {
      id: true, // 需要 id 以便单独删除
      provider: true,
      providerUsername: true,
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
          // 可以在这里把 label 改为 userFriendlyName
        }
      } catch (e) {
        return {
          ...identity,
          providerUsername: '未知设备'
        }
      }
    }
    return identity
  })
})
