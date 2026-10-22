import type { H3Event } from 'h3'
import { setCookie } from 'h3'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'

type ChallengeUser = {
  id: number
  tokenVersion?: number
  email?: string | null
  emailVerified?: boolean | null
}

// 预认证令牌：完成二次验证前不落 auth-token，5 分钟有效
export function signPreAuthToken(user: ChallengeUser): string {
  return JWTEnhanced.sign(
    {
      userId: user.id,
      tokenVersion: user.tokenVersion ?? 0,
      type: 'pre-auth',
      scope: '2fa_pending'
    },
    { expiresIn: '5m' }
  )
}

// 动态构建验证方式与脱敏邮箱（邮箱需已验证才可用）
export function build2FAChallenge(user: ChallengeUser): { methods: string[]; maskedEmail: string } {
  const methods = ['totp']
  let maskedEmail = ''
  if (user.email && user.emailVerified) {
    methods.push('email')
    const [local, domain] = user.email.split('@')
    if (local && domain) {
      maskedEmail = local.length <= 2 ? `***@${domain}` : `${local.slice(0, 2)}****@${domain}`
    }
  }
  return { methods, maskedEmail }
}

export function setPreAuthCookie(event: H3Event, token: string, isSecure: boolean) {
  setCookie(event, 'pre-auth-token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/'
  })
}
