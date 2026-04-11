import { createError } from 'h3'
import type { ProviderRuntimeConfig } from '~~/server/services/oauthConfigService'

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
  getAuthorizeUrl(redirectUri: string, state: string, config?: ProviderRuntimeConfig): string

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
        throw new Error(tokenResponse.error_description || tokenResponse.error || '授权失败，请重试')
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
        getObjectByPath(userInfo, 'sub'),
        getObjectByPath(userInfo, 'uin'),
        getObjectByPath(userInfo, 'openid')
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
  oauth2: customOAuth2Strategy
}

export const getOAuthStrategy = (provider: string): OAuthStrategy => {
  const strategy = strategies[provider]
  if (!strategy) {
    throw createError({ statusCode: 400, message: `Unknown provider: ${provider}` })
  }
  return strategy
}
