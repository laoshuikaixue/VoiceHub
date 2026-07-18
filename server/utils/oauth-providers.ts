export type OAuthProvider = 'github' | 'casdoor' | 'google' | 'oauth2' | 'aggregate'

export const SUPPORTED_OAUTH_PROVIDERS: OAuthProvider[] = ['github', 'casdoor', 'google', 'oauth2', 'aggregate']

export const isSupportedOAuthProvider = (provider: string): provider is OAuthProvider => {
  return SUPPORTED_OAUTH_PROVIDERS.includes(provider as OAuthProvider)
}
