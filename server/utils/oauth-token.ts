import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}

export interface BindingTokenPayload {
  provider: string
  providerUserId: string
  providerUsername?: string
  // 如果有可靠的未认证用户会话ID，可以在此添加 sessionId
}

export const generateBindingToken = (payload: BindingTokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' })
}

export const verifyBindingToken = (token: string): BindingTokenPayload => {
  return jwt.verify(token, JWT_SECRET) as BindingTokenPayload
}
