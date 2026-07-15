import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'

export default defineEventHandler(async (event) => {
  const { rpID } = getWebAuthnConfig(event)
  if (!rpID) {
    throw createError({ statusCode: 500, message: 'WebAuthn RP ID 配置无效' })
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: []
  })

  setWebAuthnChallenge(event, options.challenge, 'authentication')

  return options
})
