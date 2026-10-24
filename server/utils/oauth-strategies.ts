import { createError } from 'h3'
import type { ProviderRuntimeConfig } from '~~/server/services/oauthConfigService'
import { isSafeAggregateOAuthUrl } from '~~/server/utils/oauth-providers'

const getObjectByPath = (source: any, path?: string): any => {
  if (!source || !path) return undefined
  return path
    .split('.')
    .reduce((acc, key) => (acc !== null && acc !== undefined ? acc[key] : undefined), source)
}

const firstStringValue = (values: any[]): string | undefined => {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return undefined
}

const getAggregateProviderMessage = (value: any): string | undefined => {
  const message = firstStringValue([value, value?.msg, value?.message, value?.error_description])
  if (!message) return undefined

  // CDN/WAF 挑战页不是聚合协议的业务错误，避免把整段 HTML 当成供应商消息记录。
  if (/<html|just a moment|cloudflare|cf-chl-|enable javascript/i.test(message)) {
    return undefined
  }

  return message
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(
      /["']?\b(app(?:id|key)|client_(?:id|secret))\b["']?\s*[:=：]\s*["']?[^\s,;"'&]+["']?/gi,
      '$1=[已隐藏]'
    )
    .trim()
    .slice(0, 200)
}

const isAggregateSecurityChallenge = (value: any): boolean => {
  const message = firstStringValue([value, value?.msg, value?.message, value?.error_description])
  return !!message && /<html|just a moment|cloudflare|cf-chl-|enable javascript/i.test(message)
}

const AGGREGATE_REQUEST_HEADERS = {
  Accept: 'application/json',
  // 部分聚合站点的 CDN 会将无 User-Agent 的服务端请求送入挑战页。
  'User-Agent':
    'Mozilla/5.0 (compatible; VoiceHub OAuth/1.0; +https://github.com/laoshuikaixue/VoiceHub)',
  'Cache-Control': 'no-cache'
}

const fetchAggregateEndpoint = async (url: string): Promise<any> => {
  return $fetch<any>(url, { headers: AGGREGATE_REQUEST_HEADERS })
}

const getAggregateAuthorizeErrorMessage = (providerMessage?: string): string =>
  providerMessage ? `聚合登陆授权地址获取失败：${providerMessage}` : '聚合登陆授权地址获取失败'

const isAggregateSuccessCode = (value: unknown): boolean =>
  value === 0 || (typeof value === 'string' && value.trim() === '0')

const normalizeAggregateEndpoint = (endpoint?: string): string => {
  const value = endpoint?.trim()
  if (!value) {
    throw createError({ statusCode: 500, message: '聚合登录接口地址未配置，请在管理员后台完成配置' })
  }
  try {
    const url = new URL(value)
    if (!isSafeAggregateOAuthUrl(url.toString())) {
      throw new Error('unsupported protocol')
    }
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\/$/, '')
    return url.toString().replace(/\/$/, '')
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 500, message: '聚合登陆接口地址配置错误' })
  }
}

export interface OAuthUserInfo {
  id: string
  username: string
  email?: string
  name?: string
  avatar?: string
}

export interface OAuthStrategy {
  /**
   * 获取授权跳转 URL
   */
  getAuthorizeUrl(
    redirectUri: string,
    state: string,
    config?: ProviderRuntimeConfig
  ): string | Promise<string>

  /**
   * 使用 code 换取 access_token
   */
  exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig): Promise<string>

  /**
   * 获取用户信息
   */
  getUserInfo(accessToken: string, config?: ProviderRuntimeConfig): Promise<OAuthUserInfo>
}

// GitHub 策略实现
const githubStrategy: OAuthStrategy = {
  getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig) {
    const clientId = config?.clientId || process.env.GITHUB_CLIENT_ID
    if (!clientId)
      throw createError({ statusCode: 500, message: 'GitHub Client ID not configured' })

    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${encodeURIComponent(state)}`
  },

  async exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig) {
    const clientId = config?.clientId || process.env.GITHUB_CLIENT_ID
    const clientSecret = config?.clientSecret || process.env.GITHUB_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw createError({ statusCode: 500, message: 'GitHub config missing' })
    }

    try {
      const tokenResponse = await $fetch<any>('https://github.com/login/oauth/access_token', {
        method: 'POST',
        body: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        },
        headers: { Accept: 'application/json' }
      })

      if (tokenResponse.error) {
        console.error('GitHub Token Error:', tokenResponse.error)
        throw new Error('授权失败，请重试')
      }

      if (!tokenResponse.access_token) {
        console.error('GitHub Token Response missing access_token')
        throw new Error('未能获取访问令牌')
      }
      return tokenResponse.access_token
    } catch (e: any) {
      console.error('GitHub token exchange failed', e.message || e)
      const errorMessage = e.data?.error_description || e.message || '令牌请求失败'
      throw new Error(errorMessage)
    }
  },

  async getUserInfo(accessToken: string) {
    try {
      const userInfo = await $fetch<any>('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      return {
        id: String(userInfo.id),
        username: userInfo.login,
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar_url
      }
    } catch (e: any) {
      console.error('GitHub user info failed', e)
      throw new Error('获取用户信息失败')
    }
  }
}

// Casdoor 策略实现
const casdoorStrategy: OAuthStrategy = {
  getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig) {
    const clientId = config?.clientId || process.env.CASDOOR_CLIENT_ID
    const endpoint = config?.endpoint || process.env.CASDOOR_ENDPOINT
    if (!clientId || !endpoint)
      throw createError({ statusCode: 500, message: 'Casdoor config missing' })

    return `${endpoint}/login/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read&state=${encodeURIComponent(state)}`
  },

  async exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig) {
    const clientId = config?.clientId || process.env.CASDOOR_CLIENT_ID
    const clientSecret = config?.clientSecret || process.env.CASDOOR_CLIENT_SECRET
    const endpoint = config?.endpoint || process.env.CASDOOR_ENDPOINT

    if (!clientId || !clientSecret || !endpoint) {
      throw createError({ statusCode: 500, message: 'Casdoor config missing' })
    }

    try {
      const tokenResponse = await $fetch<any>(`${endpoint}/login/oauth/access_token`, {
        method: 'POST',
        body: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        },
        headers: { Accept: 'application/json' }
      })

      if (tokenResponse.error) {
        console.error('Casdoor Token Error:', tokenResponse.error, tokenResponse.error_description)
        throw new Error(tokenResponse.error_description || '授权失败，请重试')
      }

      if (!tokenResponse.access_token) {
        console.error('Casdoor Token Response missing access_token')
        throw new Error('未能获取访问令牌，请检查 Casdoor 配置')
      }
      return tokenResponse.access_token
    } catch (e: any) {
      console.error('Casdoor token exchange failed', e.message || e)
      const errorMessage = e.data?.error_description || e.message || '令牌请求失败'
      throw new Error(errorMessage)
    }
  },

  async getUserInfo(accessToken: string, config?: ProviderRuntimeConfig) {
    const endpoint = config?.endpoint || process.env.CASDOOR_ENDPOINT
    if (!endpoint) throw createError({ statusCode: 500, message: 'Casdoor config missing' })

    let userInfo: any = {}
    try {
      // Casdoor 用户信息端点通常是 /api/get-account 或 /api/userinfo
      // 标准 OIDC 使用 /userinfo
      try {
        userInfo = await $fetch(`${endpoint}/api/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      } catch (e) {
        // 尝试备用端点
        userInfo = await $fetch(`${endpoint}/api/get-account`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      }

      return {
        id: String(userInfo.id || userInfo.sub),
        username: userInfo.name || userInfo.preferred_username || userInfo.username,
        name: userInfo.displayName || userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar
      }
    } catch (e: any) {
      console.error('Casdoor user info failed', e)
      throw new Error('获取用户信息失败')
    }
  }
}

// Google 策略实现
const googleStrategy: OAuthStrategy = {
  getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig) {
    const clientId = config?.clientId || process.env.GOOGLE_CLIENT_ID
    if (!clientId)
      throw createError({ statusCode: 500, message: 'Google Client ID not configured' })

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${encodeURIComponent(state)}`
  },

  async exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig) {
    const clientId = config?.clientId || process.env.GOOGLE_CLIENT_ID
    const clientSecret = config?.clientSecret || process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw createError({ statusCode: 500, message: 'Google config missing' })
    }

    try {
      const tokenResponse = await $fetch<any>('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        },
        headers: { Accept: 'application/json' }
      })

      if (tokenResponse.error) {
        console.error('Google Token Error:', tokenResponse.error)
        throw new Error('授权失败，请重试')
      }

      if (!tokenResponse.access_token) {
        console.error('Google Token Response missing access_token')
        throw new Error('未能获取访问令牌')
      }
      return tokenResponse.access_token
    } catch (e: any) {
      console.error('Google token exchange failed', e.message || e)
      const errorMessage = e.data?.error_description || e.message || '令牌请求失败'
      throw new Error(errorMessage)
    }
  },

  async getUserInfo(accessToken: string) {
    try {
      const userInfo = await $fetch<any>('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      return {
        id: userInfo.sub,
        username: userInfo.email, // Google doesn't have a username, use email
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.picture
      }
    } catch (e: any) {
      console.error('Google user info failed', e)
      throw new Error('获取用户信息失败')
    }
  }
}

// ==================== QQ 互联 OAuth（直连 graph.qq.com） ====================

const QQ_AUTHORIZE_ENDPOINT = 'https://graph.qq.com/oauth2.0/authorize'
const QQ_TOKEN_ENDPOINT = 'https://graph.qq.com/oauth2.0/token'
const QQ_OPENID_ENDPOINT = 'https://graph.qq.com/oauth2.0/me'
const QQ_USER_INFO_ENDPOINT = 'https://graph.qq.com/user/get_user_info'

/**
 * QQ 互联协议约定：access_token / openid 请求返回的是 text/plain，
 * 且 openid 接口外层包裹 callback( ... );，需要先剥壳再解析。
 */

export const buildQqAuthorizeUrl = (appId: string, redirectUri: string, state: string): string => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appId,
    redirect_uri: redirectUri,
    state
  })
  return `${QQ_AUTHORIZE_ENDPOINT}?${params.toString()}`
}

/** 解析令牌接口的 urlencoded 文本响应；QQ 业务错误时也会以 callback( {...} ) 返回 */
export const parseQqTokenResponse = (text: string): string => {
  const trimmed = (text || '').trim()
  if (!trimmed) {
    throw new Error('QQ 登录令牌响应为空')
  }

  // callback( {...} ) 形式通常是错误响应（如 code 重复使用）
  const jsonMatch = trimmed.match(/^callback\(\s*([\s\S]*?)\s*\);?$/)
  if (jsonMatch) {
    let parsed: any
    try {
      parsed = JSON.parse(jsonMatch[1])
    } catch {
      throw new Error('QQ 登录令牌响应格式无效')
    }
    const errorMessage =
      parsed?.error_description || parsed?.error || '授权失败，请重新发起 QQ 登录'
    throw new Error(errorMessage)
  }

  const params = new URLSearchParams(trimmed)
  const accessToken = params.get('access_token')
  if (!accessToken) {
    throw new Error('QQ 登录响应缺少 access_token')
  }
  return accessToken
}

/** 解析 openid 接口的 callback( {"client_id":"..","openid":".."} ) 响应 */
export const parseQqOpenIdResponse = (text: string): string => {
  const trimmed = (text || '').trim()
  const jsonMatch = trimmed.match(/^callback\(\s*([\s\S]*?)\s*\);?$/)
  if (!jsonMatch) {
    throw new Error('QQ 登录 openid 响应格式无效')
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonMatch[1])
  } catch {
    throw new Error('QQ 登录 openid 响应解析失败')
  }

  if (parsed?.error) {
    throw new Error(parsed.error_description || parsed.error)
  }

  const openid = typeof parsed?.openid === 'string' ? parsed.openid.trim() : ''
  if (!openid) {
    throw new Error('QQ 登录响应缺少 openid')
  }
  return openid
}

// QQ 互联策略实现
const qqStrategy: OAuthStrategy = {
  getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig) {
    const appId = config?.clientId
    if (!appId) {
      throw createError({ statusCode: 500, message: 'QQ 互联 App ID 未配置' })
    }
    return buildQqAuthorizeUrl(appId, redirectUri, state)
  },

  async exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig) {
    const appId = config?.clientId
    const appKey = config?.clientSecret
    if (!appId || !appKey) {
      throw createError({ statusCode: 500, message: 'QQ 互联 App ID / App Key 未配置' })
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: appKey,
      code,
      redirect_uri: redirectUri
    })

    let responseText: string
    try {
      // QQ 令牌接口为 GET 且返回 text/plain，AppKey 位于协议规定的查询串中，不记录完整 URL
      responseText = await $fetch.raw(QQ_TOKEN_ENDPOINT, {
        method: 'GET',
        params: Object.fromEntries(params),
        headers: { Accept: 'text/plain' },
        responseType: 'text'
      }).then((res) => res._data as string)
    } catch (e: any) {
      console.error('QQ 登录令牌交换失败', {
        statusCode: e?.statusCode || e?.status || 'unknown'
      })
      throw new Error('QQ 登录授权失败，无法访问 QQ 服务器')
    }

    let accessToken: string
    try {
      accessToken = parseQqTokenResponse(responseText)
    } catch (e: any) {
      // QQ 业务错误（error_description）对排查有直接价值，原样透出
      throw new Error(e?.message || 'QQ 登录授权失败，请重试')
    }

    let openIdText: string
    try {
      openIdText = await $fetch<string>(QQ_OPENID_ENDPOINT, {
        method: 'GET',
        params: { access_token: accessToken },
        headers: { Accept: 'text/plain' },
        responseType: 'text'
      })
    } catch (e: any) {
      console.error('QQ 登录 openid 获取失败', {
        statusCode: e?.statusCode || e?.status || 'unknown'
      })
      throw new Error('QQ 登录 openid 获取失败，无法访问 QQ 服务器')
    }

    let openId: string
    try {
      openId = parseQqOpenIdResponse(openIdText)
    } catch (e: any) {
      // openid 缺失/格式错误属于会话异常，提示用户重新发起登录
      throw new Error(e?.message || 'QQ 登录 openid 获取失败，请重新发起登录')
    }

    // openid 与 access_token 一并打包为"令牌"传递给 getUserInfo，
    // 保证身份唯一标识来自 QQ 侧而非可变昵称（与聚合登录同样的打包模式）。
    return Buffer.from(JSON.stringify({ accessToken, openId }), 'utf8').toString('base64url')
  },

  async getUserInfo(accessToken: string, config?: ProviderRuntimeConfig) {
    let packed: { accessToken?: string; openId?: string }
    try {
      packed = JSON.parse(Buffer.from(accessToken, 'base64url').toString('utf8'))
    } catch {
      throw new Error('QQ 登录会话数据无效，请重新发起登录')
    }

    const token = typeof packed?.accessToken === 'string' ? packed.accessToken : ''
    const openId = typeof packed?.openId === 'string' ? packed.openId : ''
    const appId = config?.clientId || ''
    if (!token || !openId || !appId) {
      throw new Error('QQ 登录会话数据不完整，请重新发起登录')
    }

    let userInfo: any
    try {
      userInfo = await $fetch<any>(QQ_USER_INFO_ENDPOINT, {
        method: 'GET',
        params: { access_token: token, oauth_consumer_key: appId, openid: openId },
        headers: { Accept: 'application/json' },
        responseType: 'json'
      })
    } catch (e: any) {
      console.error('QQ 登录用户信息获取失败', {
        statusCode: e?.statusCode || e?.status || 'unknown'
      })
      throw new Error('QQ 用户信息获取失败，无法访问 QQ 服务器')
    }

    if (userInfo?.ret !== undefined && Number(userInfo.ret) !== 0) {
      throw new Error(
        `QQ 用户信息获取失败（ret=${userInfo.ret}${userInfo?.msg ? `: ${userInfo.msg}` : ''}）`
      )
    }

    return {
      // openid 是同一 QQ 应用下用户的唯一且稳定标识，作为第三方账号关联依据
      id: openId,
      username:
        typeof userInfo?.nickname === 'string' && userInfo.nickname.trim()
          ? userInfo.nickname.trim()
          : openId,
      name: typeof userInfo?.nickname === 'string' ? userInfo.nickname : undefined,
      avatar:
        typeof userInfo?.figureurl_qq_1 === 'string'
          ? userInfo.figureurl_qq_1
          : typeof userInfo?.figureurl === 'string'
            ? userInfo.figureurl
            : undefined
    }
  }
}

const aggregateOAuthStrategy: OAuthStrategy = {
  async getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig) {
    const appid = config?.clientId
    const appkey = config?.clientSecret
    const loginType = config?.loginType?.trim() || 'qq'
    const endpoint = normalizeAggregateEndpoint(config?.endpoint)

    if (!appid || !appkey) {
      throw createError({ statusCode: 500, message: '聚合登陆配置缺失' })
    }

    const params = new URLSearchParams({
      act: 'login',
      appid,
      appkey,
      type: loginType,
      redirect_uri: redirectUri,
      state
    })

    let loginResponse: any
    try {
      loginResponse = await fetchAggregateEndpoint(`${endpoint}?${params.toString()}`)
    } catch (e: any) {
      const responseBody = e?.data || e?.response?._data
      const providerMessage = getAggregateProviderMessage(responseBody)
      // AppKey 位于协议规定的查询串中，避免记录可能包含完整请求 URL 的 FetchError。
      console.error('聚合登陆授权地址请求失败', {
        statusCode: e?.response?.status || e?.statusCode || e?.status || 'unknown',
        providerMessage,
        securityChallenge: isAggregateSecurityChallenge(responseBody)
      })
      if (isAggregateSecurityChallenge(responseBody)) {
        throw createError({
          statusCode: 502,
          message:
            '聚合登录供应商的安全防护拦截了服务器请求，请将服务器出口 IP 加白或更换供应商接口地址'
        })
      }
      throw createError({
        statusCode: 502,
        message: getAggregateAuthorizeErrorMessage(providerMessage)
      })
    }

    if (!isAggregateSuccessCode(loginResponse?.code) || !loginResponse?.url) {
      if (isAggregateSecurityChallenge(loginResponse)) {
        throw createError({
          statusCode: 502,
          message:
            '聚合登录供应商的安全防护拦截了服务器请求，请将服务器出口 IP 加白或更换供应商接口地址'
        })
      }
      const providerMessage = getAggregateProviderMessage(loginResponse)
      // 上游返回的失败原因需落日志，便于管理员排查未开通/配置错误等问题
      console.error('聚合登陆授权地址获取失败', { providerMessage })
      throw createError({
        statusCode: 502,
        message: getAggregateAuthorizeErrorMessage(providerMessage)
      })
    }

    try {
      const authorizeUrl = new URL(loginResponse.url)
      if (!isSafeAggregateOAuthUrl(authorizeUrl.toString())) {
        throw new Error('unsupported protocol')
      }
      return authorizeUrl.toString()
    } catch {
      throw createError({ statusCode: 502, message: '聚合登陆返回了无效的授权地址' })
    }
  },

  async exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig) {
    const appid = config?.clientId
    const appkey = config?.clientSecret
    const loginType = config?.loginType?.trim() || 'qq'
    const endpoint = normalizeAggregateEndpoint(config?.endpoint)

    if (!appid || !appkey) {
      throw createError({ statusCode: 500, message: '聚合登陆配置缺失' })
    }

    const params = new URLSearchParams({
      act: 'callback',
      appid,
      appkey,
      type: loginType,
      code
    })

    let tokenResponse: any
    try {
      tokenResponse = await fetchAggregateEndpoint(`${endpoint}?${params.toString()}`)
    } catch (e: any) {
      // AppKey 位于协议规定的查询串中，避免记录或继续抛出完整请求 URL。
      const responseBody = e?.data || e?.response?._data
      const providerMessage = getAggregateProviderMessage(responseBody)
      console.error('聚合登陆回调请求失败', {
        statusCode: e?.response?.status || e?.statusCode || e?.status || 'unknown',
        providerMessage,
        securityChallenge: isAggregateSecurityChallenge(responseBody)
      })
      if (isAggregateSecurityChallenge(responseBody)) {
        throw new Error(
          '聚合登录供应商的安全防护拦截了服务器请求，请将服务器出口 IP 加白或更换供应商接口地址',
          { cause: e }
        )
      }
      throw new Error(providerMessage ? `令牌请求失败：${providerMessage}` : '令牌请求失败', {
        cause: e
      })
    }

    if (!isAggregateSuccessCode(tokenResponse?.code)) {
      if (isAggregateSecurityChallenge(tokenResponse)) {
        throw new Error(
          '聚合登录供应商的安全防护拦截了服务器请求，请将服务器出口 IP 加白或更换供应商接口地址'
        )
      }
      throw new Error(getAggregateProviderMessage(tokenResponse) || '授权失败，请重试')
    }

    if (!tokenResponse?.social_uid) {
      throw new Error('聚合登陆响应缺少用户唯一标识')
    }

    return Buffer.from(JSON.stringify(tokenResponse), 'utf8').toString('base64url')
  },

  async getUserInfo(accessToken: string) {
    try {
      const userInfo = JSON.parse(Buffer.from(accessToken, 'base64url').toString('utf8'))
      const id = firstStringValue([userInfo.social_uid])
      if (!id) {
        throw new Error('用户信息中缺少 social_uid')
      }

      return {
        id,
        username: firstStringValue([userInfo.nickname, userInfo.social_uid]) || id,
        name: firstStringValue([userInfo.nickname]),
        avatar: firstStringValue([userInfo.faceimg])
      }
    } catch (e: any) {
      console.error('聚合登陆 user info failed', e)
      throw new Error(e?.message || '获取用户信息失败')
    }
  }
}

const customOAuth2Strategy: OAuthStrategy = {
  getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig) {
    const authorizeUrl = config?.authorizeUrl
    const clientId = config?.clientId
    const scope = config?.scope?.trim() || 'openid profile email'

    if (!authorizeUrl || !clientId) {
      throw createError({ statusCode: 500, message: 'Custom OAuth2 config missing' })
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state
    })

    return `${authorizeUrl}${authorizeUrl.includes('?') ? '&' : '?'}${params.toString()}`
  },

  async exchangeToken(code: string, redirectUri: string, config?: ProviderRuntimeConfig) {
    const tokenUrl = config?.tokenUrl
    const clientId = config?.clientId
    const clientSecret = config?.clientSecret

    if (!tokenUrl || !clientId || !clientSecret) {
      throw createError({ statusCode: 500, message: 'Custom OAuth2 config missing' })
    }

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })

      const tokenResponse = await $fetch<any>(tokenUrl, {
        method: 'POST',
        body,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      if (tokenResponse?.error) {
        throw new Error(
          tokenResponse.error_description || tokenResponse.error || '授权失败，请重试'
        )
      }

      if (!tokenResponse?.access_token) {
        throw new Error('未能获取访问令牌')
      }
      return tokenResponse.access_token
    } catch (e: any) {
      console.error('Custom OAuth2 token exchange failed', e.message || e)
      const errorMessage = e?.data?.error_description || e?.message || '令牌请求失败'
      throw new Error(errorMessage)
    }
  },

  async getUserInfo(accessToken: string, config?: ProviderRuntimeConfig) {
    const userInfoUrl = config?.userInfoUrl
    if (!userInfoUrl) {
      throw createError({ statusCode: 500, message: 'Custom OAuth2 config missing' })
    }

    try {
      const userInfo = await $fetch<any>(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      const id = firstStringValue([
        getObjectByPath(userInfo, config?.userIdField),
        getObjectByPath(userInfo, 'id'),
        getObjectByPath(userInfo, 'sub')
      ])

      if (!id) {
        throw new Error('用户信息中缺少唯一标识字段，请配置用户 ID 字段')
      }

      const username = firstStringValue([
        getObjectByPath(userInfo, config?.usernameField),
        getObjectByPath(userInfo, 'username'),
        getObjectByPath(userInfo, 'preferred_username'),
        getObjectByPath(userInfo, 'email'),
        getObjectByPath(userInfo, 'name'),
        id
      ])

      return {
        id,
        username: username || id,
        name: firstStringValue([
          getObjectByPath(userInfo, config?.nameField),
          getObjectByPath(userInfo, 'name')
        ]),
        email: firstStringValue([
          getObjectByPath(userInfo, config?.emailField),
          getObjectByPath(userInfo, 'email')
        ]),
        avatar: firstStringValue([
          getObjectByPath(userInfo, config?.avatarField),
          getObjectByPath(userInfo, 'avatar'),
          getObjectByPath(userInfo, 'picture')
        ])
      }
    } catch (e: any) {
      console.error('Custom OAuth2 user info failed', e)
      throw new Error(e?.message || '获取用户信息失败')
    }
  }
}

// 策略注册表
const strategies: Record<string, OAuthStrategy> = {
  github: githubStrategy,
  casdoor: casdoorStrategy,
  google: googleStrategy,
  qq: qqStrategy,
  oauth2: customOAuth2Strategy,
  aggregate: aggregateOAuthStrategy
}

export const getOAuthStrategy = (provider: string): OAuthStrategy => {
  const strategy = strategies[provider]
  if (!strategy) {
    throw createError({ statusCode: 400, message: `Unknown provider: ${provider}` })
  }
  return strategy
}
