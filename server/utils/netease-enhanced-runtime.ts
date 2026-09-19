export function isNeteaseEnhancedApiAvailable(userAgent?: string): boolean {
  return userAgent !== 'Cloudflare-Workers'
}
