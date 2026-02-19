import CryptoJS from 'crypto-js'
import { randomBytes } from 'node:crypto'

const SECRET_KEY = process.env.OAUTH_STATE_SECRET

if (!SECRET_KEY) {
  throw new Error('OAUTH_STATE_SECRET environment variable is required')
}

export interface OAuthState {
  target: string
  csrf: string
  timestamp: number
  provider?: string
}

// 生成 OAuth 状态参数
export const generateState = (
  targetOrigin: string,
  provider?: string
): { state: string; csrf: string } => {
  const csrf = randomBytes(32).toString('hex')
  const payload: OAuthState = {
    target: targetOrigin,
    csrf,
    timestamp: Date.now(),
    provider
  }
  const json = JSON.stringify(payload)
  const state = CryptoJS.AES.encrypt(json, SECRET_KEY).toString()
  return { state, csrf }
}

// 解析 OAuth 状态参数
export const parseState = (
  stateStr: string,
  expectedOrigin?: string,
  expectedCsrf?: string
): OAuthState | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(stateStr, SECRET_KEY)
    const json = bytes.toString(CryptoJS.enc.Utf8)
    if (!json) return null

    const payload = JSON.parse(json)

    // 检查时间戳是否过期（例如：10分钟）
    if (Date.now() - payload.timestamp > 10 * 60 * 1000) {
      console.error('OAuth state expired')
      return null
    }

    // 验证 target origin
    if (expectedOrigin && payload.target !== expectedOrigin) {
      console.error('OAuth state target mismatch')
      return null
    }

    // 验证 CSRF
    if (!expectedCsrf || payload.csrf !== expectedCsrf) {
      console.error('OAuth state CSRF mismatch or missing cookie')
      return null
    }

    return payload
  } catch (e) {
    console.error('Failed to parse OAuth state', e)
    return null
  }
}

export const getRedirectUri = (provider: string): string => {
  let redirectUri = process.env.OAUTH_REDIRECT_URI
  if (!redirectUri) {
    throw createError({ statusCode: 500, message: 'OAUTH_REDIRECT_URI not configured' })
  }

  // 支持 [provider] 占位符
  redirectUri = redirectUri.replace('[provider]', provider)

  // 兼容用户可能错误地将 "provider" 作为字面量填写的情况
  if (redirectUri.includes('/provider/callback')) {
    redirectUri = redirectUri.replace('/provider/callback', `/${provider}/callback`)
  }

  return redirectUri
}
