import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { randomBytes } from 'node:crypto'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { and, db, eq, userIdentities, users } from '~/drizzle/db'

type WebAuthnTransport = 'internal' | 'hybrid' | 'usb' | 'nfc' | 'ble'

const VALID_TRANSPORTS = new Set<WebAuthnTransport>(['internal', 'hybrid', 'usb', 'nfc', 'ble'])

function getCredentialTransports(serializedData: string | null): WebAuthnTransport[] {
  try {
    const data = JSON.parse(serializedData || '{}')
    const transports = Array.isArray(data.transports)
      ? data.transports.filter(
          (transport: unknown): transport is WebAuthnTransport =>
            typeof transport === 'string' && VALID_TRANSPORTS.has(transport as WebAuthnTransport)
        )
      : []

    // 鸿蒙可能不实现 getTransports，但本机系统 Passkey 仍属于平台认证器。
    return transports.length ? transports : ['internal']
  } catch {
    return ['internal']
  }
}

export default defineEventHandler(async (event) => {
  const { rpID } = getWebAuthnConfig(event)
  if (!rpID) {
    throw createError({ statusCode: 500, message: 'WebAuthn RP ID 配置无效' })
  }

  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''

  let allowCredentials: Array<{ id: string; transports: WebAuthnTransport[] }> = []
  if (username) {
    const credentials = await db
      .select({
        id: userIdentities.providerUserId,
        data: userIdentities.providerUsername
      })
      .from(userIdentities)
      .innerJoin(users, eq(userIdentities.userId, users.id))
      .where(and(eq(users.username, username), eq(userIdentities.provider, 'webauthn')))

    allowCredentials = credentials.length
      ? credentials.map((credential) => ({
          id: credential.id,
          transports: getCredentialTransports(credential.data)
        }))
      : [{ id: randomBytes(32).toString('base64url'), transports: ['internal'] }]
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials
  })

  setWebAuthnChallenge(event, options.challenge, 'authentication')

  return options
})
