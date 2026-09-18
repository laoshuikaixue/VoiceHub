type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RoutePolicy {
  path: string
  methods: readonly HttpMethod[]
}

const GET_METHODS = ['GET', 'HEAD'] as const
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const

export const PASSWORD_CHANGE_ALLOWED_ROUTES: readonly RoutePolicy[] = [
  { path: '/api/auth/verify', methods: GET_METHODS },
  { path: '/api/auth/logout', methods: ['POST'] },
  { path: '/api/auth/change-password', methods: ['POST'] },
  { path: '/api/auth/set-initial-password', methods: ['POST'] },
  { path: '/api/auth/2fa/verify', methods: ['POST'] },
  { path: '/api/auth/2fa/send-email', methods: ['POST'] },
  { path: '/api/site-config', methods: GET_METHODS }
]

export const PUBLIC_API_EXACT_ROUTES: readonly RoutePolicy[] = [
  { path: '/api/music-source-plugins/media', methods: GET_METHODS },
  { path: '/api/auth/login', methods: ['POST'] },
  { path: '/api/auth/register', methods: ['POST'] },
  { path: '/api/auth/email-code', methods: ['POST'] },
  { path: '/api/auth/grade-class-options', methods: GET_METHODS },
  // 携带 binding-token（而非登录态 token）访问，必须放行给接口自身校验
  { path: '/api/auth/oauth-register-options', methods: GET_METHODS },
  { path: '/api/auth/bind', methods: ['POST'] },
  { path: '/api/auth/oauth-register', methods: ['POST'] },
  { path: '/api/auth/2fa/verify', methods: ['POST'] },
  { path: '/api/auth/2fa/send-email', methods: ['POST'] },
  { path: '/api/auth/forgot-password', methods: ['POST'] },
  { path: '/api/auth/reset-password', methods: ['POST'] },
  { path: '/api/auth/captcha', methods: GET_METHODS },
  { path: '/api/semesters/current', methods: GET_METHODS },
  { path: '/api/play-times', methods: GET_METHODS },
  { path: '/api/schedules/public', methods: GET_METHODS },
  { path: '/api/songs/count', methods: GET_METHODS },
  { path: '/api/songs/public', methods: GET_METHODS },
  { path: '/api/site-config', methods: GET_METHODS },
  { path: '/api/system/location', methods: GET_METHODS },
  { path: '/api/auth/webauthn/login', methods: ['POST'] },
  { path: '/api/music/resolve-url', methods: ['POST'] },
  { path: '/api/music/state', methods: ['POST'] },
  { path: '/api/music/websocket', methods: GET_METHODS },
  { path: '/api/sys/time', methods: GET_METHODS }
]

// /api/music-source-plugins/* 不在公开 API 白名单中，要求登录态。
// 与 /api/native-api/ 的区别：native-api 是标准内置音源功能，面向匿名用户；
// 插件音源是管理员录入的第三方脚本，虽在 QuickJS/WASM 沙箱内执行（无宿主模块与文件、进程能力），
// 但沙箱仍按协议开放出站 http 能力，存在 SSRF 与出站请求放大风险，故要求登录。
// 例外：/api/music-source-plugins/media 由密封 ticket 授权，需作为 <audio> 直接请求的媒体代理匿名放行。
export const PUBLIC_API_PREFIX_ROUTES: readonly RoutePolicy[] = [
  { path: '/api/proxy/', methods: GET_METHODS },
  { path: '/api/bilibili/', methods: GET_METHODS },
  { path: '/api/api-enhanced/', methods: [...GET_METHODS, ...WRITE_METHODS] },
  { path: '/api/native-api/', methods: [...GET_METHODS, 'POST'] },
  { path: '/api/open/', methods: [...GET_METHODS, ...WRITE_METHODS] },
  { path: '/api/auth/webauthn/login/', methods: ['POST'] }
]

function matchesMethod(policy: RoutePolicy, method: string): boolean {
  return policy.methods.includes(method.toUpperCase() as HttpMethod)
}

export function isPublicApiPath(pathname: string, method: string): boolean {
  return (
    PUBLIC_API_EXACT_ROUTES.some(
      (policy) => pathname === policy.path && matchesMethod(policy, method)
    ) ||
    PUBLIC_API_PREFIX_ROUTES.some(
      (policy) => pathname.startsWith(policy.path) && matchesMethod(policy, method)
    )
  )
}

export function isAllowedDuringPasswordChange(pathname: string, method: string): boolean {
  return PASSWORD_CHANGE_ALLOWED_ROUTES.some(
    (policy) => pathname === policy.path && matchesMethod(policy, method)
  )
}

export function shouldBlockDuringPasswordChange(
  pathname: string,
  method: string,
  requirePasswordChange: boolean
): boolean {
  return (
    requirePasswordChange &&
    !isPublicApiPath(pathname, method) &&
    !isAllowedDuringPasswordChange(pathname, method)
  )
}

export function shouldBypassPublicApiAuthentication(
  pathname: string,
  method: string,
  hasToken: boolean
): boolean {
  return isPublicApiPath(pathname, method) && !hasToken
}

export function canBindOAuthIdentity(requirePasswordChange: boolean): boolean {
  return !requirePasswordChange
}
