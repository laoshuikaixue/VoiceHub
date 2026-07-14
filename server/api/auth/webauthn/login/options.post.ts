import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { randomBytes } from 'node:crypto'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { and, db, eq, userIdentities, users } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const { rpID } = getWebAuthnConfig(event)
  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''

  let allowCredentials: Array<{ id: string; type: 'public-key' }> = []
  if (username) {
    const credentials = await db
      .select({ id: userIdentities.providerUserId })
      .from(userIdentities)
      .innerJoin(users, eq(userIdentities.userId, users.id))
      .where(and(eq(users.username, username), eq(userIdentities.provider, 'webauthn')))

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
