export const getProviderDisplayName = (provider: string): string => {
  const map: Record<string, string> = {
    github: 'GitHub',
    casdoor: 'Casdoor',
    google: 'Google',
    oauth2: '第三方 OAuth'
  }
  return map[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1)
}
