export const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/api/auth/verify',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/auth/set-initial-password',
  '/api/auth/2fa/verify',
  '/api/auth/2fa/send-email',
  '/api/site-config'
] as const

export const PUBLIC_API_EXACT_PATHS = [
  '/api/auth/login',
  '/api/auth/bind',
  '/api/auth/oauth-register',
  '/api/auth/2fa/verify',
  '/api/auth/2fa/send-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/captcha',
  '/api/semesters/current',
  '/api/play-times',
  '/api/schedules/public',
  '/api/songs/count',
  '/api/songs/public',
  '/api/site-config',
  '/api/system/location',
  '/api/auth/webauthn/login',
  '/api/music/resolve-url',
  '/api/music/state',
  '/api/music/websocket',
  '/api/sys/time'
] as const

export const PUBLIC_API_PATH_PREFIXES = [
  '/api/proxy/',
  '/api/bilibili/',
  '/api/api-enhanced/',
  '/api/native-api/',
  '/api/open/',
  '/api/auth/webauthn/login/'
] as const

export function isPublicApiPath(pathname: string): boolean {
  return (
    PUBLIC_API_EXACT_PATHS.some((path) => pathname === path) ||
    PUBLIC_API_PATH_PREFIXES.some((path) => pathname.startsWith(path))
  )
}

export function isAllowedDuringPasswordChange(pathname: string): boolean {
  return PASSWORD_CHANGE_ALLOWED_PATHS.some((path) => pathname === path)
}

export function shouldBlockDuringPasswordChange(
  pathname: string,
  requirePasswordChange: boolean
): boolean {
  return (
    requirePasswordChange &&
    !isPublicApiPath(pathname) &&
    !isAllowedDuringPasswordChange(pathname)
  )
}

export function shouldBypassPublicApiAuthentication(pathname: string, hasToken: boolean): boolean {
  return isPublicApiPath(pathname) && !hasToken
}
