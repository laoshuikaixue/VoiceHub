// 强制改密期间仅保留维持登录态和完成改密所必需的接口，避免公共业务接口绕过安全拦截。
export const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/api/auth/verify',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/auth/set-initial-password',
  '/api/auth/2fa/verify',
  '/api/auth/2fa/send-email'
] as const

export const PUBLIC_API_PATH_PREFIXES = [
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
  '/api/proxy/',
  '/api/bilibili/',
  '/api/api-enhanced/',
  '/api/native-api/',
  '/api/system/location',
  '/api/open/',
  '/api/auth/webauthn/login',
  '/api/music/resolve-url',
  '/api/music/state',
  '/api/music/websocket',
  '/api/sys/time'
] as const

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATH_PREFIXES.some((path) => pathname.startsWith(path))
}

export function isAllowedDuringPasswordChange(pathname: string): boolean {
  return PASSWORD_CHANGE_ALLOWED_PATHS.some((path) => path === pathname)
}

// 匿名访问仍保持公共语义；一旦请求携带登录态，就必须经过强制改密等完整安全检查。
export function shouldBypassPublicApiAuthentication(pathname: string, hasToken: boolean): boolean {
  return isPublicApiPath(pathname) && !hasToken
}
