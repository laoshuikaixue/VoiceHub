import CryptoJS from 'crypto-js'
import { randomBytes } from 'node:crypto'
import { createError } from 'h3'

export interface OAuthState {
  target: string
  csrf: string
  timestamp: number
  provider?: string
}

const toUrlSafeBase64 = (value: string): string => {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromUrlSafeBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = normalized.length % 4
  if (padLength === 0) return normalized
  return normalized + '='.repeat(4 - padLength)
}

const buildStateCandidates = (stateStr: string): string[] => {
  const trimmed = stateStr.trim()
  const candidates = [
    trimmed,
    // 某些 OAuth 回调会把 `+` 误解码为空格，这里做兼容恢复
    trimmed.replace(/ /g, '+')
  ]

  // 支持 URL-safe Base64（新格式）以及带填充/不带填充的输入
  const withBase64 = candidates.flatMap(item => [item, fromUrlSafeBase64(item)])

  return Array.from(new Set(withBase64.filter(Boolean)))
}

const tryParseStatePayload = (stateCandidate: string, secretKey: string): OAuthState | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(stateCandidate, secretKey)
    const json = bytes.toString(CryptoJS.enc.Utf8)
    if (!json) return null
    return JSON.parse(json) as OAuthState
  } catch {
    return null
  }
}

const normalizePort = (url: URL): string => {
  if (url.port) return url.port
  if (url.protocol === 'https:') return '443'
  if (url.protocol === 'http:') return '80'
  return ''
}

// 生成 OAuth 状态参数
export const generateState = (
  targetOrigin: string,
  provider?: string,
  secretKey?: string
): { state: string; csrf: string } => {
  if (!secretKey) {
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
  const rawState = CryptoJS.AES.encrypt(json, secretKey).toString()
  // 统一输出 URL-safe，避免在中间代理/回调中出现 `+` 被替换为空格
  const state = toUrlSafeBase64(rawState)
  return { state, csrf }
}

// 解析 OAuth 状态参数
export const parseState = (
  stateStr: string,
  expectedOrigin?: string,
  expectedCsrf?: string,
  secretKey?: string
): OAuthState | null => {
  if (!secretKey) {
    throw createError({
      statusCode: 500,
      message: 'OAuth State 密钥未配置，请在管理员后台配置 OAuth State 密钥'
    })
  }

  try {
    let payload: OAuthState | null = null
    for (const candidate of buildStateCandidates(stateStr)) {
      payload = tryParseStatePayload(candidate, secretKey)
      if (payload) break
    }

    if (!payload) return null

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
        // 使用 hostname 避免端口导致误判，端口单独比较
        const expectedHost = expectedUrl.hostname
        const payloadHost = payloadUrl.hostname
        const expectedPort = normalizePort(expectedUrl)
        const payloadPort = normalizePort(payloadUrl)
        
        // hostname 相同时也要校验端口一致，避免同 host 不同端口被接受
        if (expectedHost === payloadHost) {
          if (expectedPort !== payloadPort) {
            console.error(`OAuth state port mismatch: ${expectedPort} vs ${payloadPort}`)
            return null
          }
        } else {
          // host 不同 - 检查是否为已知的需要兼容的环境
          // 仅在 *.github.dev（Codespaces 环境）中允许不同的子域名
          const isExpectedGitHubDev =
            expectedHost.endsWith('.github.dev') || expectedHost === 'localhost' || expectedHost === '127.0.0.1'
          const isPayloadGitHubDev =
            payloadHost.endsWith('.github.dev') || payloadHost === 'localhost' || payloadHost === '127.0.0.1'
          
          if (isExpectedGitHubDev && isPayloadGitHubDev) {
            // 在 Codespaces 等环境中，允许子域名变化（例如端口号变化导致的 subdomain 变化）
            // 但仍需要验证基础域名相同（.github.dev）
            const expectedParts = expectedHost.split('.')
            const payloadParts = payloadHost.split('.')
            
            // 对于 localhost, 要求完全相同
            if (expectedHost === 'localhost' || payloadHost === 'localhost') {
              if (expectedHost !== payloadHost || expectedPort !== payloadPort) {
                console.error(`OAuth state host/port mismatch (localhost): ${expectedHost}:${expectedPort} vs ${payloadHost}:${payloadPort}`)
                return null
              }
            } else if (expectedHost === '127.0.0.1' || payloadHost === '127.0.0.1') {
              // 对于 127.0.0.1，也要求完全相同
              if (expectedHost !== payloadHost || expectedPort !== payloadPort) {
                console.error(`OAuth state host/port mismatch (127.0.0.1): ${expectedHost}:${expectedPort} vs ${payloadHost}:${payloadPort}`)
                return null
              }
            } else {
              // 对于 *.github.dev，允许不同的子域名，但要求基础部分相同
              // 例如：crispy-funicular-q77p479p56r9hx7vr-3000.app.github.dev 
              // 和 crispy-funicular-q77p479p56r9hx7vr.app.github.dev 都可以通过
              const expectedBase = expectedParts.slice(-3).join('.')
              const payloadBase = payloadParts.slice(-3).join('.')
              
              if (expectedBase !== payloadBase) {
                console.error(`OAuth state domain mismatch: ${expectedBase} vs ${payloadBase}`)
                return null
              }
            }
          } else {
            // 对于非白名单环境，要求 host 完全相同
            console.error(`OAuth state host mismatch: ${expectedHost} vs ${payloadHost}`)
            return null
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
  let redirectUri = redirectUriTemplate
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
