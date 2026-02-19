import { getCookie, setCookie, deleteCookie, type H3Event } from 'h3'
import { JWTEnhanced } from './jwt-enhanced'

const COOKIE_NAME = 'webauthn_challenge'

interface WebAuthnChallengePayload {
  challenge: string
  userId: string
  type: string
}

export function setWebAuthnChallenge(event: H3Event, challenge: string, userId: string) {
  const token = JWTEnhanced.sign({
    challenge,
    userId,
    type: 'webauthn_challenge'
  }, { expiresIn: '3m' })

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 180,
    path: '/'
  })
}

export function getWebAuthnChallenge(event: H3Event): { challenge: string; userId: string } | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null

  try {
    const payload = JWTEnhanced.verify(token) as WebAuthnChallengePayload
    if (payload.type !== 'webauthn_challenge') return null
    return { challenge: payload.challenge, userId: payload.userId }
  } catch {
    return null
  }
}

export function clearWebAuthnChallenge(event: H3Event) {
  deleteCookie(event, COOKIE_NAME)
}
