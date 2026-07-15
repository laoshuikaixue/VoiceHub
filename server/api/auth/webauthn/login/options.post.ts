import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { randomBytes } from 'node:crypto'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { and, db, desc, eq, userIdentities, users } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const { rpID } = getWebAuthnConfig(event)
  if (!rpID) {
    throw createError({ statusCode: 500, message: 'WebAuthn RP ID 配置无效' })
  }

  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''

  let allowCredentials: Array<{ id: string; type: 'public-key' }> = []
  if (username) {
    const credentials = await db
      .select({ id: userIdentities.providerUserId })
      .from(userIdentities)
      .innerJoin(users, eq(userIdentities.userId, users.id))
      .where(and(eq(users.username, username), eq(userIdentities.provider, 'webauthn')))
      // 为兼容可能优先尝试首个 ID 的鸿蒙凭据桥，新注册的当前设备凭据应优先匹配。
      .orderBy(desc(userIdentities.createdAt))

    allowCredentials = credentials.length
      ? credentials.map((credential) => ({ id: credential.id, type: 'public-key' }))
      : [{ id: randomBytes(32).toString('base64url'), type: 'public-key' }]
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials
  })

  setWebAuthnChallenge(event, options.challenge, 'authentication')

  return options
})
