import { useLocale } from '~/utils/locale'

export const getProviderDisplayName = (provider: string): string => {
  const { auth } = useLocale()
  const map: Record<string, string> = {
    github: 'GitHub',
    casdoor: 'Casdoor',
    google: 'Google',
    oauth2: auth.value.oauthButtons.customOAuthProvider
  }
  return map[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1)
}
