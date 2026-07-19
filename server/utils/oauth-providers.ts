export type OAuthProvider = 'github' | 'casdoor' | 'google' | 'oauth2' | 'aggregate'

export const AGGREGATE_OAUTH_LOGIN_TYPES = [
  'qq',
  'wx',
  'alipay',
  'douyin',
  'google',
  'twitter',
  'feishu'
] as const

export type AggregateOAuthLoginType = (typeof AGGREGATE_OAUTH_LOGIN_TYPES)[number]

export const normalizeAggregateOAuthLoginTypes = (value: unknown): AggregateOAuthLoginType[] => {
  let values: unknown[] = []

  if (Array.isArray(value)) {
    values = value
  } else if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim()
    try {
      const parsed = JSON.parse(normalized)
      values = Array.isArray(parsed) ? parsed : [normalized]
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
