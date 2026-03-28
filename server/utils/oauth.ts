import CryptoJS from 'crypto-js'
import { randomBytes } from 'node:crypto'

export interface OAuthState {
  target: string
  csrf: string
  timestamp: number
  provider?: string
}

// 生成 OAuth 状态参数
export const generateState = (
  targetOrigin: string,
  provider?: string,
  secretKey?: string
): { state: string; csrf: string } => {
  const key = secretKey || process.env.OAUTH_STATE_SECRET
  if (!key) {
    throw createError({
      statusCode: 500,
      message: 'OAuth State 密钥未配置，请在管理员后台配置 OAuth State 密钥'
    })
  }

  const csrf = randomBytes(32).toString('hex')
  const payload: OAuthState = {
    target: targetOrigin,
    csrf,
    timestamp: Date.now(),
    provider
  }
  const json = JSON.stringify(payload)
  const state = CryptoJS.AES.encrypt(json, key).toString()
  return { state, csrf }
}

// 解析 OAuth 状态参数
export const parseState = (
  stateStr: string,
  expectedOrigin?: string,
  expectedCsrf?: string,
  secretKey?: string
): OAuthState | null => {
  try {
    const key = secretKey || process.env.OAUTH_STATE_SECRET
    if (!key) return null

    const bytes = CryptoJS.AES.decrypt(stateStr, key)
    const json = bytes.toString(CryptoJS.enc.Utf8)
    if (!json) return null

    const payload = JSON.parse(json)

    // 检查时间戳是否过期（例如：10分钟）
    if (Date.now() - payload.timestamp > 10 * 60 * 1000) {
      console.error('OAuth state expired')
      return null
    }

    // 验证 target origin - 在Codespaces等环境中，两次请求可能使用不同的host
    // 所以我们只验证protocol相同，但允许不同的subdomain
    if (expectedOrigin && payload.target) {
      try {
        const expectedUrl = new URL(expectedOrigin)
        const payloadUrl = new URL(payload.target)
        
        // 如果protocol不匹配，拒绝
        if (expectedUrl.protocol !== payloadUrl.protocol) {
          console.error(`OAuth state protocol mismatch: ${expectedUrl.protocol} vs ${payloadUrl.protocol}`)
          return null
        }
        
        // 判断是否为相同的源站
        // 对于localhost和*.github.dev之类的，允许不同的subdomain
        const expectedHost = expectedUrl.host
        const payloadHost = payloadUrl.host
        
        // 完全相同则直接通过
        if (expectedHost === payloadHost) {
          // 通过
        } else {
          // 不同的host - 在Codespaces中这很正常
          // 只要是相同的基础域名即可通过（例如都是.github.dev）
          const expectedParts = expectedHost.split('.')
          const payloadParts = payloadHost.split('.')
          
          // 如果是localhost，要求完全相同
          if (expectedHost.includes('localhost') || payloadHost.includes('localhost')) {
            if (expectedHost !== payloadHost) {
              console.error(`OAuth state host mismatch (localhost): ${expectedHost} vs ${payloadHost}`)
              return null
            }
          } else {
            // 对于其他情况，允许不同的subdomain，但要求基础域名相同
            // 例如：crispy-funicular-q77p479p56r9hx7vr-3000.app.github.dev 
            // 和 crispy-funicular-q77p479p56r9hx7vr.app.github.dev 都可以通过
            const expectedDomain = expectedParts.slice(-2).join('.')
            const payloadDomain = payloadParts.slice(-2).join('.')
            
            if (expectedDomain !== payloadDomain) {
              console.error(`OAuth state domain mismatch: ${expectedDomain} vs ${payloadDomain}`)
              return null
            }
            
            console.log(`OAuth state origin mismatch but domain matches: ${expectedHost} vs ${payloadHost}`)
          }
        }
      } catch (e) {
        console.error('Failed to parse OAuth state URLs', e)
        return null
      }
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

export const getRedirectUri = (provider: string, redirectUriTemplate?: string): string => {
  let redirectUri = redirectUriTemplate || process.env.OAUTH_REDIRECT_URI
  if (!redirectUri) {
    throw createError({
      statusCode: 500,
      message: 'OAuth 重定向 URI 未配置，请在管理员后台配置 OAuth 重定向 URI'
    })
  }

  // 支持 [provider] 占位符
  redirectUri = redirectUri.replace('[provider]', provider)

  // 兼容用户可能错误地将 "provider" 作为字面量填写的情况
  if (redirectUri.includes('/provider/callback')) {
    redirectUri = redirectUri.replace('/provider/callback', `/${provider}/callback`)
  }

  return redirectUri
}
