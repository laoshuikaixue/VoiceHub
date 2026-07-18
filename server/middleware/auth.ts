import { JWTEnhanced } from '../utils/jwt-enhanced'
import { db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { isUserBlocked, getUserBlockRemainingTime } from '../services/securityService'
import { isSupportedOAuthProvider } from '../services/oauthConfigService'
import { isSecureRequest } from '../utils/request-utils'
import { resolveRequirePasswordChange } from '../utils/system-settings-helper'
import {
  isAllowedDuringPasswordChange,
  isPublicApiPath,
  shouldBypassPublicApiAuthentication
} from '../utils/auth-route-policy'
import { isAdminRole } from '#shared/auth-constants'

// 仅对"页面 HTML 渲染请求"做软认证：排除 Nuxt 内部路径、构建产物、静态资源等
const NON_PAGE_PREFIXES = [
  '/_nuxt',
  '/__nuxt',
  '/_payload',
  '/_ipx',
  '/_loading',
  '/favicon',
  '/images/',
  '/audio-match/',
  '/robots.txt'
]

const isPageRenderRequest = (pathname: string): boolean => {
  if (pathname.startsWith('/api/')) return false
  if (NON_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) return false
  // 仅匹配已知静态资源后缀，避免含点号的路由（如 /user/name.surname）被误判
  if (/\.(?:js|mjs|cjs|css|map|json|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|wasm|mp3|mp4|webm)$/i.test(pathname)) {
    return false
  }
  return true
}

const OPTIONAL_AUTH_API_ROUTES = [
  { method: 'GET', path: '/api/request-times' },
  { method: 'GET', path: '/api/songs' },
  { method: 'POST', path: '/api/blacklist/check' },
  { method: 'GET', path: '/api/system/instance' },
  { method: 'POST', path: '/api/system/reconnect' },
  { method: 'GET', path: '/api/system/status' }
]

const isOptionalAuthApiRequest = (method: string | undefined, pathname: string): boolean => {
  return OPTIONAL_AUTH_API_ROUTES.some((route) => route.method === method && route.path === pathname)
}

export default defineEventHandler(async (event) => {
  // 清除用户上下文
  if (event.context.user) {
    delete event.context.user
  }

  const url = getRequestURL(event)
  const pathname = url.pathname

  const isApiRequest = pathname.startsWith('/api/')
  const isPageRequest = !isApiRequest && isPageRenderRequest(pathname)
  const requestMethod = event.node.req.method || 'GET'
  const isOptionalAuthApi = isApiRequest && isOptionalAuthApiRequest(requestMethod, pathname)

  // 既非 API 也非 SSR 页面请求（静态资源、HMR 等）→ 直接放行
  if (!isApiRequest && !isPageRequest) {
    return
  }

  // 动态判断 OAuth 路径
  // 允许 /api/auth/[provider] 和 /api/auth/[provider]/callback
  // 但排除已知的受保护/特定 Auth 端点
  if (isApiRequest && pathname.startsWith('/api/auth/')) {
    const segments = pathname.split('/')
    const provider = segments[3]
    const isProviderIndexPath = segments.length === 4 && isSupportedOAuthProvider(provider || '')
    const isProviderCallbackPath =
      segments.length === 5 &&
      segments[4] === 'callback' &&
      isSupportedOAuthProvider(provider || '')

    if (isProviderIndexPath || isProviderCallbackPath) {
      return
    }
  }

  // 从请求头或cookie获取token
  let token: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }

  const isPublicApi = isApiRequest && isPublicApiPath(pathname)

  // 公共接口仅在匿名访问时直接放行；携带登录态时继续检查强制改密状态。
  if (isApiRequest && shouldBypassPublicApiAuthentication(pathname, Boolean(token))) return

  // 可选认证接口缺少 token 时按访客放行，由 handler 根据 event.context.user 自行降级。
  // 受保护路由缺少 token 时返回 401；页面 SSR 请求按未登录访客静默放行。
  if (!token) {
    if (isPageRequest || isOptionalAuthApi) return

    return sendError(
      event,
      createError({
        statusCode: 401,
        message: '未授权访问：缺少有效的认证信息'
      })
    )
  }

  try {
    // 验证token并自动续期
    const { valid, payload, newToken } = JWTEnhanced.verifyAndRefresh(token)

    if (!valid || !payload) {
      // 页面 SSR 请求：token 无效不是错误，按未登录访客处理
      if (isPageRequest) return
      throw new Error('Token无效')
    }

    // 如果生成了新token，更新cookie
    if (newToken) {
      const isSecure = isSecureRequest(event)
      setCookie(event, 'auth-token', newToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7天
        path: '/'
      })
    }

    const decoded = payload
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        grade: users.grade,
        class: users.class,
        role: users.role,
        status: users.status,
        passwordChangedAt: users.passwordChangedAt,
        forcePasswordChange: users.forcePasswordChange,
        email: users.email,
        emailVerified: users.emailVerified
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1)

    const user = userResult[0] || null

    // 用户不存在或状态异常时token无效
    if (!user || user.status !== 'active') {
      const isSecure = isSecureRequest(event)
      setCookie(event, 'auth-token', '', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      })

      // 页面 SSR 请求：清除失效 cookie 后按未登录访客处理，避免页面渲染因 401 中断
      if (isPageRequest) return

      const errorMessage = !user
        ? '用户不存在，请重新登录'
        : user.status === 'withdrawn'
          ? '该账号已退学，限制访问'
          : user.status === 'graduate'
            ? '该账号已毕业，限制访问'
            : '该账号已被禁用'

      return sendError(
        event,
        createError({
          statusCode: 401,
          message: errorMessage
        })
      )
    }

    // 检查token是否在密码修改之前签发（强制旧token失效）
    if (user.passwordChangedAt && decoded.iat) {
      const passwordChangedTime = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
      if (decoded.iat < passwordChangedTime) {
        const isSecure = isSecureRequest(event)
        setCookie(event, 'auth-token', '', {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 0,
          path: '/'
        })

        // 页面 SSR：旧 token 在密码改后失效，按访客处理
        if (isPageRequest) return

        return sendError(
          event,
          createError({
            statusCode: 401,
            message: '密码已修改，请重新登录',
            data: { invalidToken: true, passwordChanged: true }
          })
        )
      }
    }

    // 计算强制改密状态并附加到上下文
    // 这样 verify.get.ts、前端 SSR 中间件等下游消费者无需重复计算。
    const requirePasswordChange = await resolveRequirePasswordChange(user)
    const hasSetPassword = !!user.passwordChangedAt

    if (isUserBlocked(user.id)) {
      delete event.context.user
      if (isPageRequest) {
        const isSecure = isSecureRequest(event)
        setCookie(event, 'auth-token', '', {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 0,
          path: '/'
        })
        return
      }

      const remaining = getUserBlockRemainingTime(user.id)
      return sendError(
        event,
        createError({
          statusCode: 401,
          message: `账户处于风险控制期，请在 ${remaining} 分钟后重试`
        })
      )
    }

    event.context.user = {
      ...user,
      requirePasswordChange,
      hasSetPassword
    }

    // 页面 SSR 请求只负责软认证和上下文注入。管理员页面重定向由前端全局中间件处理。
    if (isPageRequest) {
      return
    }

    // 强制改密拦截：未完成改密前，禁止访问除白名单外的所有 API
    // 这是后端硬性校验，防止技术用户绕过前端中间件直接调用接口。
    if (!isAllowedDuringPasswordChange(pathname) && requirePasswordChange) {
      return sendError(
        event,
        createError({
          statusCode: 403,
          message: '请先完成密码修改后再访问其他功能',
          data: { requirePasswordChange: true }
        })
      )
    }

    // 检查管理员专用路由
    if (
      pathname.startsWith('/api/admin') &&
      !isAdminRole(user.role)
    ) {
      return sendError(
        event,
        createError({
          statusCode: 403,
          message: '需要管理员权限'
        })
      )
    }
  } catch (error: any) {
    // 页面 SSR：token 解析异常时静默放行（按访客处理），避免 SSR 直接 500
    if (isPageRequest) return

    // 公共接口携带过期或损坏的登录态时仍按匿名请求处理，避免破坏其公共可用性。
    if (isPublicApi) {
      delete event.context.user
      return
    }

    // 处理JWT验证错误
    return sendError(
      event,
      createError({
        statusCode: 401,
        message: `认证失败: ${error.message}`,
        data: { invalidToken: true }
      })
    )
  }
})
