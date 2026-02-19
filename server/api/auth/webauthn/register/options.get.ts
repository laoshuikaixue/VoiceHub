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

  // 获取该用户已绑定的 WebAuthn 凭证
  const existingCredentials = await db.query.userIdentities.findMany({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'webauthn')),
    columns: {
      providerUserId: true
    }
  })

  // 防止重复注册相同凭证
  const excludeCredentials = existingCredentials.map(cred => ({
    id: cred.providerUserId,
    type: 'public-key' as const,
    transports: ['internal']
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
    },
  })

  // 存储注册挑战到 Cookie
  setWebAuthnChallenge(event, options.challenge, user.id.toString())

  return options
})
