import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { getAggregateOAuthLoginTypesOrDefault } from '~~/server/utils/oauth-providers'

export type { OAuthProvider } from '~~/server/utils/oauth-providers'
export {
  SUPPORTED_OAUTH_PROVIDERS,
  isSupportedOAuthProvider
} from '~~/server/utils/oauth-providers'

export interface ProviderRuntimeConfig {
  clientId?: string
  clientSecret?: string
  endpoint?: string
  authorizeUrl?: string
  tokenUrl?: string
  userInfoUrl?: string
  scope?: string
  displayName?: string
  userIdField?: string
  usernameField?: string
  nameField?: string
  emailField?: string
  avatarField?: string
  loginType?: string
  loginTypes?: string[]
}

const getSettings = async () => {
  const settingsResult = await db.select().from(systemSettings).limit(1)
  return settingsResult[0] || null
}

export const isOAuthProviderEnabled = async (provider: OAuthProvider): Promise<boolean> => {
  const settings = await getSettings()
  if (!settings) return false

  if (provider === 'github') return !!settings.githubOAuthEnabled
  if (provider === 'casdoor') return !!settings.casdoorOAuthEnabled
  if (provider === 'google') return !!settings.googleOAuthEnabled
  if (provider === 'oauth2') return !!settings.customOAuthEnabled
  if (provider === 'aggregate') return !!settings.aggregateOAuthEnabled

  return false
}

export const getProviderRuntimeConfig = async (
  provider: OAuthProvider
): Promise<ProviderRuntimeConfig> => {
  const settings = await getSettings()

  if (!settings) return {}

  if (provider === 'github') {
    return {
      clientId: settings.githubClientId || undefined,
      clientSecret: settings.githubClientSecret || undefined
    }
  }

  if (provider === 'casdoor') {
    return {
      clientId: settings.casdoorClientId || undefined,
      clientSecret: settings.casdoorClientSecret || undefined,
      endpoint: settings.casdoorServerUrl || undefined
    }
  }

  if (provider === 'oauth2') {
    return {
      clientId: settings.customOAuthClientId || undefined,
      clientSecret: settings.customOAuthClientSecret || undefined,
      authorizeUrl: settings.customOAuthAuthorizeUrl || undefined,
      tokenUrl: settings.customOAuthTokenUrl || undefined,
      userInfoUrl: settings.customOAuthUserInfoUrl || undefined,
      scope: settings.customOAuthScope || undefined,
      displayName: settings.customOAuthDisplayName || undefined,
      userIdField: settings.customOAuthUserIdField || undefined,
      usernameField: settings.customOAuthUsernameField || undefined,
      nameField: settings.customOAuthNameField || undefined,
      emailField: settings.customOAuthEmailField || undefined,
      avatarField: settings.customOAuthAvatarField || undefined
    }
  }

  if (provider === 'aggregate') {
    const loginTypes = getAggregateOAuthLoginTypesOrDefault(settings.aggregateOAuthLoginType)
    return {
      clientId: settings.aggregateOAuthAppId || undefined,
      clientSecret: settings.aggregateOAuthAppKey || undefined,
      loginTypes,
      endpoint: settings.aggregateOAuthEndpoint || undefined
    }
  }

  return {
    clientId: settings.googleClientId || undefined,
    clientSecret: settings.googleClientSecret || undefined
  }
}

export const getOAuthProviderDisplayName = async (provider: OAuthProvider): Promise<string> => {
  if (provider !== 'oauth2') {
    if (provider === 'github') return 'GitHub'
    if (provider === 'casdoor') return 'Casdoor'
    if (provider === 'google') return 'Google'
    if (provider === 'aggregate') return '聚合登陆'
  }

  const settings = await getSettings()
  return settings?.customOAuthDisplayName || '第三方 OAuth'
}

export const getOAuthBaseConfig = async (): Promise<{
  stateSecret?: string
  redirectUriTemplate?: string
}> => {
  const settings = await getSettings()
  if (!settings) {
    return {
      stateSecret: undefined,
      redirectUriTemplate: undefined
    }
  }

  return {
    stateSecret: settings.oauthStateSecret || undefined,
    redirectUriTemplate: settings.oauthRedirectUri || undefined
  }
}
