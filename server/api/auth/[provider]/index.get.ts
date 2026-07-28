import {
  encodeOAuthStateCookie,
  generateCompactOAuthState,
  generateState,
  getOAuthStateCookieNames,
  getRedirectUri,
  getSafeOAuthReturnPath
} from '~~/server/utils/oauth'
import { getOAuthStrategy } from '~~/server/utils/oauth-strategies'
import {
  getOAuthBaseConfig,
  getProviderRuntimeConfig,
  isOAuthProviderEnabled,
  isSupportedOAuthProvider
} from '~~/server/services/oauthConfigService'
import { getRequestOrigin, getSafeRequestProtocol } from '~~/server/utils/request-utils'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!provider) {
    throw createApiError(400, 'AUTH_MISSING_PROVIDER', 'Missing provider')
  }

  if (!isSupportedOAuthProvider(provider)) {
    throw createApiError(400, 'AUTH_UNSUPPORTED_OAUTH_PROVIDER', '当前仅支持 GitHub / Casdoor / Google / 聚合登陆 / 第三方 OAuth2')
  }

  const enabled = await isOAuthProviderEnabled(provider)
  if (!enabled) {
    throw createApiError(403, 'AUTH_OAUTH_PROVIDER_DISABLED', 'OAuth provider is disabled')
  }

  const query = getQuery(event)
  const { stateSecret, redirectUriTemplate } = await getOAuthBaseConfig()
  const providerConfig = await getProviderRuntimeConfig(provider)
  let aggregateLoginType: string | undefined

  if (provider === 'aggregate') {
    aggregateLoginType =
      typeof query.type === 'string' ? query.type.trim().toLowerCase() : undefined
    if (!aggregateLoginType || !providerConfig.loginTypes?.includes(aggregateLoginType)) {
      throw createApiError(400, 'AUTH_AGGREGATED_LOGIN_UNSUPPORTED', '未启用或不支持的聚合登录方式')
    }
    providerConfig.loginType = aggregateLoginType
  }

  const strategy = getOAuthStrategy(provider)

  // 获取 Origin
  const origin = getRequestOrigin(event)
  const protocol = getSafeRequestProtocol(event)

  const redirectUri = getRedirectUri(provider, redirectUriTemplate)

  // 代理平台可能重写服务端可见的 Host，且 Auth-Broker 场景下回调域名本就与源站不同，
  // 因此这里只校验回调地址格式，回调请求仍会通过 state、CSRF 和 host-only Cookie 完成来源验证。
  try {
    const redirectUrl = new URL(redirectUri)
    if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
      throw new Error('unsupported protocol')
    }
  } catch {
    throw createApiError(400, 'AUTH_OAUTH_REDIRECT_INVALID', 'OAuth 重定向 URI 配置无效，请在管理员后台检查配置')
  }

  const returnTo = getSafeOAuthReturnPath(query.redirect)
  const { state, csrf } = generateState(origin, provider, stateSecret, returnTo, aggregateLoginType)

  // 在开发环境 (HTTP) 中，必须将 secure 设置为 false，否则浏览器会拒绝设置 cookie
  const isHttps = protocol === 'https'

  let authorizeState = state
  if (provider === 'aggregate') {
    authorizeState = generateCompactOAuthState(origin, stateSecret)

    // 限制并发授权流程数量，防止被放弃的流程在 Cookie 中无限累积导致请求头超限
    const existingCookies = parseCookies(event)
    const pendingSuffixes = new Set<string>()
    for (const name of Object.keys(existingCookies)) {
      const suffix = name.match(/^oauth_(?:csrf|full_state|compact_state)_(.+)$/)?.[1]
      if (suffix) pendingSuffixes.add(suffix)
    }
    if (pendingSuffixes.size >= 3) {
      for (const suffix of pendingSuffixes) {
        deleteCookie(event, `oauth_csrf_${suffix}`, { path: '/' })
        deleteCookie(event, `oauth_full_state_${suffix}`, { path: '/' })
        deleteCookie(event, `oauth_compact_state_${suffix}`, { path: '/' })
      }
    }
  }
  const stateCookieNames = getOAuthStateCookieNames(
    provider === 'aggregate' ? authorizeState : undefined
  )
  const stateCookieOptions = {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    maxAge: 60 * 10,
    path: '/'
  }

  // 不指定 domain，让每个授权流程的 Cookie 绑定到当前 host 和独立 state。
  setCookie(event, stateCookieNames.csrf, csrf, stateCookieOptions)

  if (provider === 'aggregate') {
    setCookie(event, stateCookieNames.fullState, encodeOAuthStateCookie(state), stateCookieOptions)
    setCookie(event, stateCookieNames.compactState, authorizeState, stateCookieOptions)
  }

  let url: string
  try {
    url = await strategy.getAuthorizeUrl(redirectUri, authorizeState, providerConfig)
  } catch (error: any) {
    if (provider !== 'aggregate') throw error

    deleteCookie(event, stateCookieNames.csrf, { path: '/' })
    deleteCookie(event, stateCookieNames.fullState, { path: '/' })
    deleteCookie(event, stateCookieNames.compactState, { path: '/' })
    const statusCode = error?.statusCode || 500
    console.error('聚合登录方式暂不可用', {
      loginType: aggregateLoginType,
      statusCode,
      message: error?.message
    })
    // 区分服务端配置缺失与上游未开通，避免误导管理员排查方向
    const errorMessage =
      statusCode === 500
        ? '聚合登录配置不完整，请联系管理员检查配置。'
        : '当前登录方式暂不可用，可能尚未在聚合登录服务中开通。请尝试其他登录方式或联系管理员。'
    return sendRedirect(
      event,
      `/auth/error?code=AGGREGATE_LOGIN_UNAVAILABLE&message=${encodeURIComponent(errorMessage)}`
    )
  }

  return sendRedirect(event, url)
})
