export const AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS = [
  { value: 'qq', label: 'QQ' },
  { value: 'wx', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'douyin', label: '抖音' },
  { value: 'huawei', label: '华为' },
  { value: 'xiaomi', label: '小米' },
  { value: 'feishu', label: '飞书' }
] as const

const AGGREGATE_OAUTH_LOGIN_TYPE_ICONS: Record<string, string> = {
  qq: 'oauth-qq',
  wx: 'oauth-wechat',
  alipay: 'oauth-alipay',
  douyin: 'oauth-douyin',
  huawei: 'oauth-huawei',
  xiaomi: 'oauth-xiaomi',
  feishu: 'oauth-feishu'
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
  return (
    AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS.find((item) => item.value === loginType)?.label ||
    loginType.toUpperCase()
  )
}

export const getAggregateOAuthLoginTypeIcon = (loginType: string): string => {
  return AGGREGATE_OAUTH_LOGIN_TYPE_ICONS[loginType] || 'user'
}

export const getProviderDisplayName = (provider: string): string => {
  const normalizedProvider = provider.toLowerCase()
  if (normalizedProvider.startsWith('aggregate:')) {
    const loginType = normalizedProvider.slice('aggregate:'.length)
    return `${getAggregateOAuthLoginTypeName(loginType)} 登录`
  }

  const map: Record<string, string> = {
    github: 'GitHub',
    casdoor: 'Casdoor',
    google: 'Google',
    oauth2: '第三方 OAuth',
    aggregate: '聚合登陆'
  }
  return map[normalizedProvider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}
