import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { setWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'

export default defineEventHandler(async (event) => {
  const { rpID } = getWebAuthnConfig(event)

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: [], 
  })

  setWebAuthnChallenge(event, options.challenge, 'authentication')

  return options
})
