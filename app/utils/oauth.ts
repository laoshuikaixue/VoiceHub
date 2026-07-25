import { useLocale } from '~/utils/locale'

export const AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS = [
  { value: 'qq', label: 'QQ' },
  { value: 'wx', label: 'WeChat' },
  { value: 'alipay', label: 'Alipay' },
  { value: 'douyin', label: 'Douyin' }
] as const

const AGGREGATE_OAUTH_LOGIN_TYPE_ICONS: Record<string, string> = {
  qq: 'oauth-qq',
  wx: 'oauth-wechat',
  alipay: 'oauth-alipay',
  douyin: 'oauth-douyin'
}

export const normalizeAggregateOAuthLoginTypes = (value: unknown): string[] => {
  let values: unknown[] = []

  if (Array.isArray(value)) {
    values = value
  } else if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim()
    try {
      const parsed = JSON.parse(normalized)
      values = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      values = normalized.split(',')
    }
  }

  const supported = new Set<string>(AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS.map((item) => item.value))
  return [
    ...new Set(
      values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => supported.has(item))
    )
  ]
}

export const getAggregateOAuthLoginTypesOrDefault = (value: unknown): string[] => {
  const normalized = normalizeAggregateOAuthLoginTypes(value)
  const hasConfiguredValue =
    (Array.isArray(value) && value.length > 0) ||
    (typeof value === 'string' && value.trim().length > 0)
  return normalized.length > 0 || hasConfiguredValue ? normalized : ['qq']
}

export const getAggregateOAuthLoginTypeName = (loginType: string): string => {
  const { auth } = useLocale()
  const localizedName = auth.value?.oauthButtons?.aggregateLoginTypes?.[loginType]
  return (
    localizedName ||
    AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS.find((item) => item.value === loginType)?.label ||
    loginType.toUpperCase()
  )
}

export const getAggregateOAuthLoginTypeIcon = (loginType: string): string => {
  return AGGREGATE_OAUTH_LOGIN_TYPE_ICONS[loginType] || 'user'
}

export const getProviderDisplayName = (provider: string): string => {
  const { auth } = useLocale()
  const normalizedProvider = provider.toLowerCase()
  if (normalizedProvider.startsWith('aggregate:')) {
    const loginType = normalizedProvider.slice('aggregate:'.length)
    const providerName = getAggregateOAuthLoginTypeName(loginType)
    const formatter = auth.value?.oauthButtons?.aggregateProviderName
    return typeof formatter === 'function' ? formatter(providerName) : `${providerName} 登录`
  }

  const map: Record<string, string> = {
    github: 'GitHub',
    casdoor: 'Casdoor',
    google: 'Google',
    oauth2: auth.value?.oauthButtons?.customOAuthProvider || '第三方 OAuth',
    aggregate: auth.value?.oauthButtons?.aggregateOAuthProvider || '聚合登录'
  }
  return map[normalizedProvider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}
