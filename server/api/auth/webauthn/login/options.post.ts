import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'

export default defineEventHandler(async (event) => {
  const { rpID } = getWebAuthnConfig(event)

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    // 允许任何凭证（Discoverable Credentials）
    allowCredentials: [], 
  })

  // 存储 Challenge
  setWebAuthnChallenge(event, options.challenge, 'unknown')

  return options
})
