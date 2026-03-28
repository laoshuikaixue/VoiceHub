import { generateState, getRedirectUri } from '~~/server/utils/oauth'
import { getOAuthStrategy } from '~~/server/utils/oauth-strategies'
import {
  getOAuthBaseConfig,
  getProviderRuntimeConfig,
  isOAuthProviderEnabled,
  isSupportedOAuthProvider
} from '~~/server/services/oauthConfigService'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!provider) {
    throw createError({ statusCode: 400, message: 'Missing provider' })
  }

  if (!isSupportedOAuthProvider(provider)) {
    throw createError({ statusCode: 400, message: '当前仅支持 GitHub / Casdoor / Google / 第三方 OAuth2' })
  }

  const enabled = await isOAuthProviderEnabled(provider)
  if (!enabled) {
    throw createError({ statusCode: 403, message: 'OAuth provider is disabled' })
  }

  const { stateSecret, redirectUriTemplate } = await getOAuthBaseConfig()
  const providerConfig = await getProviderRuntimeConfig(provider)

  const strategy = getOAuthStrategy(provider)

  // 获取 Origin
  const headers = getRequestHeaders(event)
  const protocol = headers['x-forwarded-proto'] || 'http'
  const host = headers['host']
  const origin = `${protocol}://${host}`

  console.log(`[OAuth] ${provider} authorize - Origin:`, origin, 'Host:', host, 'Protocol:', protocol)

  const redirectUri = getRedirectUri(provider, redirectUriTemplate)

  const { state, csrf } = generateState(origin, provider, stateSecret)

  // 在开发环境 (HTTP) 中，必须将 secure 设置为 false，否则浏览器会拒绝设置 cookie
  const isHttps = protocol === 'https'
  
  // 为了兼容不同的部署环境（本地、Docker、Codespaces等），
  // 不指定domain，让浏览器自动使用当前请求的host
  setCookie(event, 'oauth_csrf', csrf, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'strict' : 'lax',
    maxAge: 60 * 10, // 10分钟
    path: '/'
    // 注意：不设置 domain，让浏览器使用当前 host
  })
  
  console.log(`[OAuth] ${provider} authorize - CSRF cookie set. CSRF:`, csrf.substring(0, 8) + '...')

  const url = strategy.getAuthorizeUrl(redirectUri, state, providerConfig)

  return sendRedirect(event, url)
})
