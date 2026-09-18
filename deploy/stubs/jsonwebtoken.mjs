// jsonwebtoken 的边缘兼容子集：VoiceHub 仅使用 HS256 的同步 sign/verify/decode。
// 原包依赖 jws 的 Node Stream 类，workerd 下会在模块初始化时因 CJS 互操作失败。
import { createHmac, timingSafeEqual } from 'node:crypto'

const b64url = (value) => Buffer.from(value).toString('base64url')
const parseB64url = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))

const durationSeconds = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d|w)$/i)
  if (!match) throw new Error(`expiresIn 格式无效: ${value}`)
  const factors = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }
  return Number(match[1]) * factors[match[2].toLowerCase()]
}

const createJwtError = (name, message) => Object.assign(new Error(message), { name })

const sign = (payload, secret, options = {}) => {
  if (!secret) throw new Error('secretOrPrivateKey must have a value')
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload }
  if (!options.noTimestamp && body.iat === undefined) body.iat = now
  const expires = durationSeconds(options.expiresIn)
  if (expires !== undefined && body.exp === undefined) body.exp = now + expires
  if (options.notBefore !== undefined && body.nbf === undefined) {
    body.nbf = now + durationSeconds(options.notBefore)
  }
  if (options.jwtid !== undefined) body.jti = options.jwtid
  if (options.audience !== undefined) body.aud = options.audience
  if (options.issuer !== undefined) body.iss = options.issuer
  if (options.subject !== undefined) body.sub = options.subject

  const header = { alg: 'HS256', typ: 'JWT', ...(options.header || {}) }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

const verify = (token, secret, options = {}) => {
  if (!secret) throw createJwtError('JsonWebTokenError', 'secret or public key must be provided')
  const parts = String(token).split('.')
  if (parts.length !== 3) throw createJwtError('JsonWebTokenError', 'jwt malformed')

  let header
  let payload
  try {
    header = parseB64url(parts[0])
    payload = parseB64url(parts[1])
  } catch {
    throw createJwtError('JsonWebTokenError', 'invalid token')
  }
  if (header.alg !== 'HS256') throw createJwtError('JsonWebTokenError', 'invalid algorithm')

  const expected = createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest()
  const actual = Buffer.from(parts[2], 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw createJwtError('JsonWebTokenError', 'invalid signature')
  }

  const now = options.clockTimestamp ?? Math.floor(Date.now() / 1000)
  const tolerance = options.clockTolerance || 0
  if (!options.ignoreNotBefore && typeof payload.nbf === 'number' && payload.nbf > now + tolerance) {
    throw createJwtError('NotBeforeError', 'jwt not active')
  }
  if (!options.ignoreExpiration && typeof payload.exp === 'number' && payload.exp <= now - tolerance) {
    throw createJwtError('TokenExpiredError', 'jwt expired')
  }
  return options.complete ? { header, payload, signature: parts[2] } : payload
}

const decode = (token, options = {}) => {
  try {
    const parts = String(token).split('.')
    if (parts.length < 2) return null
    const header = parseB64url(parts[0])
    const payload = parseB64url(parts[1])
    return options.complete ? { header, payload, signature: parts[2] || '' } : payload
  } catch {
    return null
  }
}

const jwt = { sign, verify, decode }
export default jwt
export { sign, verify, decode }
