import { db, eq, and, users, userIdentities } from '~/drizzle/db'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { createApiError } from '~~/server/utils/apiError'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const body = await readBody(event)
  const { provider, id } = body

  if (!provider) {
    throw createApiError(400, 'AUTH_MISSING_PROVIDER_PARAM', '缺少提供商参数')
  }

  const whereCondition = id
    ? and(
        eq(userIdentities.id, id),
        eq(userIdentities.userId, user.id),
        eq(userIdentities.provider, provider)
      )
    : and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, provider))

  const rpID = provider === 'webauthn' ? getWebAuthnConfig(event).rpID : undefined
  const removedIdentities = await db.transaction(async (tx) => {
    const targetIdentities = await tx.query.userIdentities.findMany({
      where: whereCondition,
      columns: {
        id: true,
        provider: true,
        providerUserId: true,
        providerUsername: true,
        avatar: true,
        createdAt: true
      }
    })

    const userRecord = await tx.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        avatarProvider: true,
        avatarProviderUserId: true
      }
    })
    const targetKeys = new Set(
      targetIdentities.map((identity) => `${identity.provider}:${identity.providerUserId}`)
    )
    const isDeletingAvatarSource =
      !!userRecord &&
      targetIdentities.some(
        (identity) =>
          identity.provider === userRecord.avatarProvider &&
          identity.providerUserId === userRecord.avatarProviderUserId
      )

    if (isDeletingAvatarSource) {
      const allIdentities = await tx.query.userIdentities.findMany({
        where: eq(userIdentities.userId, user.id),
        columns: {
          id: true,
          provider: true,
          providerUserId: true,
          providerUsername: true,
          avatar: true,
          createdAt: true
        }
      })
      const remainingIdentities = allIdentities.filter(
        (identity) => !targetKeys.has(`${identity.provider}:${identity.providerUserId}`)
      )
      const fallback = resolveAvatarSource(userRecord, remainingIdentities)
      await tx
        .update(users)
        .set({
          avatarProvider: fallback?.provider ?? null,
          avatarProviderUserId: fallback?.providerUserId ?? null
        })
        .where(eq(users.id, user.id))
    }

    return tx
      .delete(userIdentities)
      .where(whereCondition)
      .returning({ credentialId: userIdentities.providerUserId })
  })

  const passkeyCleanup = rpID
    ? removedIdentities.map((identity) => ({
        credentialId: identity.credentialId,
        rpId: rpID
      }))
    : []

  return { success: true, passkeyCleanup }
})
