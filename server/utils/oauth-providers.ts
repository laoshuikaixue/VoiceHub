export type OAuthProvider = 'github' | 'casdoor' | 'google' | 'oauth2' | 'aggregate'

export const AGGREGATE_OAUTH_LOGIN_TYPES = ['qq', 'wx', 'alipay', 'douyin'] as const

export type AggregateOAuthLoginType = (typeof AGGREGATE_OAUTH_LOGIN_TYPES)[number]

const isPrivateIPv4 = (hostname: string): boolean => {
  const parts = hostname.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  const [first, second] = parts
  return (
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

const isPrivateIPv6 = (hostname: string): boolean => {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!normalized.includes(':')) return false
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIPv4(normalized.slice('::ffff:'.length))
  }
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  )
}

const isInternalHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase()
  if (normalized.includes(':')) return isPrivateIPv6(normalized)
  if (isPrivateIPv4(normalized)) return true
  return (
    normalized === 'localhost' ||
    !normalized.includes('.') ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.lan') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.home.arpa')
  )
}

export const isSafeAggregateOAuthUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    if (url.username || url.password) return false
    if (url.protocol === 'https:') return true
    if (url.protocol !== 'http:') return false
    // AppKey 会出现在查询串中，公网 HTTP 会泄露密钥；可信内网部署仍允许显式使用 HTTP。
    return isInternalHostname(url.hostname)
  } catch {
    return false
  }
}

export const normalizeAggregateOAuthLoginTypes = (value: unknown): AggregateOAuthLoginType[] => {
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

  return [
    ...new Set(
      values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is AggregateOAuthLoginType =>
          AGGREGATE_OAUTH_LOGIN_TYPES.includes(item as AggregateOAuthLoginType)
        )
    )
  ]
}

export const getAggregateOAuthLoginTypesOrDefault = (value: unknown): AggregateOAuthLoginType[] => {
  const normalized = normalizeAggregateOAuthLoginTypes(value)
  const hasConfiguredValue =
    (Array.isArray(value) && value.length > 0) ||
    (typeof value === 'string' && value.trim().length > 0)
  return normalized.length > 0 || hasConfiguredValue ? normalized : ['qq']
}

export const SUPPORTED_OAUTH_PROVIDERS: OAuthProvider[] = [
  'github',
  'casdoor',
  'google',
  'oauth2',
  'aggregate'
]

export const isSupportedOAuthProvider = (provider: string): provider is OAuthProvider => {
  return SUPPORTED_OAUTH_PROVIDERS.includes(provider as OAuthProvider)
}
