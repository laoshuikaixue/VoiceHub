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
  const forwardedProto = (headers['x-forwarded-proto'] || '').toString()
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : 'http'
  const host = headers['host']
  const origin = `${protocol}://${host}`

  const redirectUri = getRedirectUri(provider, redirectUriTemplate)

  // CSRF Cookie 绑定在当前 host 上，若回调地址源站不一致会导致回调时拿不到 Cookie
  try {
    const redirectUrl = new URL(redirectUri)
    if (redirectUrl.host !== host || redirectUrl.protocol !== `${protocol}:`) {
      throw createError({
        statusCode: 400,
        message: 'OAuth 回调地址与当前请求源站不一致，请在管理员后台将 OAuth 重定向 URI 配置为当前站点域名'
      })
    }
  } catch (error: any) {
    if (error?.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 400,
      message: 'OAuth 重定向 URI 配置无效，请在管理员后台检查配置'
    })
  }

  const { state, csrf } = generateState(origin, provider, stateSecret)

  // 在开发环境 (HTTP) 中，必须将 secure 设置为 false，否则浏览器会拒绝设置 cookie
  const isHttps = protocol === 'https'
  
  // 为了兼容不同的部署环境（本地、Docker、Codespaces等），
  // 不指定domain，让浏览器自动使用当前请求的host
  setCookie(event, 'oauth_csrf', csrf, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10分钟
    path: '/'
    // 注意：不设置 domain，让浏览器使用当前 host
  })
  
  const url = strategy.getAuthorizeUrl(redirectUri, state, providerConfig)

  return sendRedirect(event, url)
})
