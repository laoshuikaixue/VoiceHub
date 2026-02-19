import { generateRegistrationOptions } from '@simplewebauthn/server'
import { isoUint8Array } from '@simplewebauthn/server/helpers'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { db, eq, and, userIdentities } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  // 检查已绑定的 WebAuthn 设备
  const existingCredentials = await db.query.userIdentities.findMany({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'webauthn')),
    columns: {
      providerUserId: true
    }
  })

  const excludeCredentials = existingCredentials.map(cred => ({
    id: cred.providerUserId,
    type: 'public-key' as const,
    transports: ['internal'] // 可选
  }))

  const { rpID } = getWebAuthnConfig(event)
  const rpName = 'VoiceHub'

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: isoUint8Array.fromUTF8String(user.id.toString()),
    userName: user.username || user.email,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  })

  // 存储 Challenge
  setWebAuthnChallenge(event, options.challenge, user.id)

  return options
})
