import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  GenerateRegistrationOptionsOpts,
  VerifyRegistrationResponseOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

const rpName = 'VoiceHub'
// RP ID 默认为 localhost，生产环境需配置
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || `http://${rpID}:3000`

export const webauthn = {
  generateRegistrationOptions: (opts: Omit<GenerateRegistrationOptionsOpts, 'rpName' | 'rpID'>) => {
    return generateRegistrationOptions({
      ...opts,
      rpName,
      rpID,
    })
  },

  verifyRegistrationResponse: (opts: Omit<VerifyRegistrationResponseOpts, 'expectedOrigin' | 'expectedRPID'>) => {
    return verifyRegistrationResponse({
      ...opts,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  },

  generateAuthenticationOptions: (opts?: Omit<GenerateAuthenticationOptionsOpts, 'rpID'>) => {
    return generateAuthenticationOptions({
      ...opts,
      rpID,
    })
  },

  verifyAuthenticationResponse: (opts: Omit<VerifyAuthenticationResponseOpts, 'expectedOrigin' | 'expectedRPID'>) => {
    return verifyAuthenticationResponse({
      ...opts,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  },
  
  helpers: {
    isoBase64URL
  }
}
