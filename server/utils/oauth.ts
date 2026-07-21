import CryptoJS from 'crypto-js'
import { createHmac, randomBytes } from 'node:crypto'

export interface OAuthState {
  target: string
  csrf: string
  timestamp: number
  provider?: string
  returnTo?: string
  loginType?: string
}

export const getSafeOAuthReturnPath = (value: unknown): string | undefined => {
  const path = Array.isArray(value) ? value[0] : value
  return typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\')
    ? path
    : undefined
}

const normalizePort = (url: URL): string => {
  if (url.port) return url.port
  if (url.protocol === 'https:') return '443'
  if (url.protocol === 'http:') return '80'
  return ''
}

const OAUTH_STATE_COOKIE_PREFIX = 'b64url:'

// AES state 是标准 Base64，Cookie 中只需转换为 URL 安全格式以避免 +、/、= 被改写。
export const encodeOAuthStateCookie = (state: string): string =>
  `${OAUTH_STATE_COOKIE_PREFIX}${Buffer.from(state, 'base64').toString('base64url')}`

export const decodeOAuthStateCookie = (state: string): string => {
  if (!state.startsWith(OAUTH_STATE_COOKIE_PREFIX)) {
    return state
  }

  const encodedState = state.slice(OAUTH_STATE_COOKIE_PREFIX.length)
  if (!encodedState || !/^[A-Za-z0-9_-]+$/.test(encodedState)) {
    return ''
  }

  try {
    const decodedState = Buffer.from(encodedState, 'base64url')
    if (decodedState.toString('base64url') !== encodedState) {
      return ''
    }
    return decodedState.toString('base64')
  } catch {
    return ''
  }
}

// 生成 OAuth 状态参数
export const generateState = (
  targetOrigin: string,
  provider?: string,
  secretKey?: string,
  returnTo?: string,
  loginType?: string
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
    provider,
    returnTo: getSafeOAuthReturnPath(returnTo),
    loginType
  }
  const json = JSON.stringify(payload)
  const state = CryptoJS.AES.encrypt(json, secretKey).toString()
  return { state, csrf }
}

// 聚合登录服务会把 state 截断为 100 字符，因此 Broker 只接收可验签的短路由信息。
export const generateCompactOAuthState = (targetOrigin: string, secretKey?: string): string => {
  if (!secretKey) {
    throw createError({ statusCode: 500, message: 'OAuth State 密钥未配置' })
  }

  const target = new URL(targetOrigin).origin
  const encodedTarget = Buffer.from(target, 'utf8').toString('base64url')
  const nonce = randomBytes(8).toString('base64url')
  const payload = `v1.${encodedTarget}.${nonce}`
  const signature = createHmac('sha256', secretKey)
    .update(payload)
    .digest()
    .subarray(0, 12)
    .toString('base64url')
  const state = `${payload}.${signature}`

  if (state.length > 100) {
    throw createError({
      statusCode: 400,
      message: '当前站点地址过长，无法兼容聚合登录的 state 长度限制'
    })
  }

  return state
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

  // 修复 base64 中的 '+' 在 URL 传输中被错误解析为空格的问题
  // 某些 OAuth 提供商或浏览器环境可能会导致 URL 查询参数中的 '+' 号变成空格
  const sanitizedStateStr = stateStr.replace(/ /g, '+')

  try {
    const bytes = CryptoJS.AES.decrypt(sanitizedStateStr, secretKey)
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
          console.error(
            `OAuth state protocol mismatch: ${expectedUrl.protocol} vs ${payloadUrl.protocol}`
          )
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
            expectedHost.endsWith('.github.dev') ||
            expectedHost === 'localhost' ||
            expectedHost === '127.0.0.1'
          const isPayloadGitHubDev =
            payloadHost.endsWith('.github.dev') ||
            payloadHost === 'localhost' ||
            payloadHost === '127.0.0.1'

          if (isExpectedGitHubDev && isPayloadGitHubDev) {
            // 在 Codespaces 等环境中，允许子域名变化（例如端口号变化导致的 subdomain 变化）
            // 但仍需要验证基础域名相同（.github.dev）
            const expectedParts = expectedHost.split('.')
            const payloadParts = payloadHost.split('.')

            // 对于 localhost, 要求完全相同
            if (expectedHost === 'localhost' || payloadHost === 'localhost') {
              if (expectedHost !== payloadHost || expectedPort !== payloadPort) {
                console.error(
                  `OAuth state host/port mismatch (localhost): ${expectedHost}:${expectedPort} vs ${payloadHost}:${payloadPort}`
                )
                return null
              }
            } else if (expectedHost === '127.0.0.1' || payloadHost === '127.0.0.1') {
              // 对于 127.0.0.1，也要求完全相同
              if (expectedHost !== payloadHost || expectedPort !== payloadPort) {
                console.error(
                  `OAuth state host/port mismatch (127.0.0.1): ${expectedHost}:${expectedPort} vs ${payloadHost}:${payloadPort}`
                )
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

    payload.returnTo = getSafeOAuthReturnPath(payload.returnTo)
    return payload
  } catch {
    // 解密失败通常来自密钥不一致或客户端状态损坏，不应作为服务端异常上报。
    console.warn('OAuth state 解密失败：state 已损坏、被截断或 OAuth State 密钥不一致')
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
