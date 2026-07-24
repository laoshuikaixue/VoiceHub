import { db, eq, and, userIdentities } from '~/drizzle/db'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { createApiError } from '~~/server/utils/apiError'

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
  const removedIdentities = await db
    .delete(userIdentities)
    .where(whereCondition)
    .returning({ credentialId: userIdentities.providerUserId })

  const passkeyCleanup = rpID
    ? removedIdentities.map((identity) => ({
        credentialId: identity.credentialId,
        rpId: rpID
      }))
    : []

  return { success: true, passkeyCleanup }
})
