export const getProviderDisplayName = (provider: string): string => {
  const map: Record<string, string> = {
    github: 'GitHub',
    casdoor: 'Casdoor',
    google: 'Google',
    oauth2: '第三方 OAuth',
    aggregate: '聚合登陆'
  }
  return map[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1)
}
