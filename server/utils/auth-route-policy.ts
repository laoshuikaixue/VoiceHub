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
  { path: '/api/auth/login', methods: ['POST'] },
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
  { path: '/api/music/websocket', methods: GET_METHODS },
  { path: '/api/sys/time', methods: GET_METHODS }
]

export const PUBLIC_API_PREFIX_ROUTES: readonly RoutePolicy[] = [
  { path: '/api/proxy/', methods: GET_METHODS },
  { path: '/api/bilibili/', methods: GET_METHODS },
  { path: '/api/api-enhanced/', methods: [...GET_METHODS, ...WRITE_METHODS] },
  { path: '/api/native-api/', methods: [...GET_METHODS, 'POST'] },
  { path: '/api/open/', methods: [...GET_METHODS, ...WRITE_METHODS] },
  { path: '/api/auth/webauthn/login/', methods: ['POST'] }
]

function normalizeMethod(method: string): HttpMethod | '' {
  return method.toUpperCase() as HttpMethod
}

function matchesMethod(policy: RoutePolicy, method: string): boolean {
  return policy.methods.includes(normalizeMethod(method) as HttpMethod)
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
