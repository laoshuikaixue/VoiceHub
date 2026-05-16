import { JWTEnhanced } from '../utils/jwt-enhanced'
import { db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { isUserBlocked, getUserBlockRemainingTime } from '../services/securityService'
import { isSupportedOAuthProvider } from '../services/oauthConfigService'
import { isSecureRequest } from '../utils/request-utils'
import { resolveRequirePasswordChange } from '../utils/system-settings-helper'
import { isAdminRole } from '#shared/auth-constants'

// 强制改密期间允许访问的 API 白名单（仅与登录态维护和改密流程相关的最小集合）
// 注意：/api/auth/2fa/verify 和 /api/auth/2fa/send-email 已在 publicApiPaths 中，
// 不会到达此处的强制改密拦截逻辑，因此无需在此白名单中重复。
// 不应使用宽泛的前缀匹配（如 /api/auth/2fa/），以防未来新增的 2FA 管理接口被意外放行。
const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/api/auth/verify',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/auth/set-initial-password'
]

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
  if (/\.(js|css|map|json|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|eot|wasm|mp3|mp4|webm)$/.test(pathname)) return false
  return true
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

  // 既非 API 也非 SSR 页面请求（静态资源、HMR 等）→ 直接放行
  if (!isApiRequest && !isPageRequest) {
    return
  }

  // 公共API路径（仅 API 请求需要做白名单跳过；页面请求始终走"软认证"流程）
  if (isApiRequest) {
    const publicApiPaths = [
      '/api/auth/login',
      '/api/auth/captcha', // 验证码图片
      '/api/auth/bind', // 账号绑定
      '/api/auth/oauth-register',
      '/api/auth/2fa/verify',
      '/api/auth/2fa/send-email',
      '/api/auth/forgot-password', // 找回密码
      '/api/auth/reset-password', // 重置密码
      '/api/semesters/current',
      '/api/play-times',
      '/api/schedules/public',
      '/api/songs/count',
      '/api/songs/public',
      '/api/site-config',
      '/api/proxy/', // 代理API路径，用于图片代理等功能
      '/api/bilibili/', // 哔哩哔哩相关API
      '/api/api-enhanced/', // 网易云音乐API代理路径
      '/api/native-api/', // Native Music 集成API
      '/api/system/location', // 系统位置检测API
      '/api/open/', // 开放API路径，由api-auth中间件处理认证
      '/api/auth/webauthn/login', // WebAuthn 登录接口
      '/api/music/state', // 音乐状态同步
      '/api/music/websocket' // WebSocket 连接
    ]

    // 公共路径跳过认证检查
    if (publicApiPaths.some((path) => pathname.startsWith(path))) {
      return
    }

    // 动态判断 OAuth 路径
    // 允许 /api/auth/[provider] 和 /api/auth/[provider]/callback
    // 但排除已知的受保护/特定 Auth 端点
    if (pathname.startsWith('/api/auth/')) {
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

  // 受保护路由缺少token时返回401错误（仅针对 API 请求）
  // 页面 SSR 请求：无 token 视为未登录访客，静默放行交由前端中间件处理
  if (!token) {
    if (isApiRequest) {
      return sendError(
        event,
        createError({
          statusCode: 401,
          message: '未授权访问：缺少有效的认证信息'
        })
      )
    }
    return
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
        forcePasswordChange: users.forcePasswordChange
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
    // 这样 verify.get.ts、前端 SSR 中间件等下游消费者无需重复计算
    // resolveRequirePasswordChange 内部已包含短路优化（管理员显式标志 / 已设置密码时直接返回）
    const requirePasswordChange = await resolveRequirePasswordChange(user)
    const hasSetPassword = !!user.passwordChangedAt

    // 页面 SSR 请求：在附加上下文之前补全两层安全校验，确保受限用户无法通过 SSR 渲染敏感内容。
    if (isPageRequest) {
      // 1. 风控锁定校验：被锁定的用户 token 虽有效但不应渲染任何页面，清除 cookie 后
      //    前端中间件将视为未认证并重定向到 /login，与 API 层的 401 策略一致。
      if (isUserBlocked(user.id)) {
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

      // 2. 管理员路由校验：非管理员访问 /admin* 时，前端中间件 auth.global.ts 
      //    会处理重定向到 /dashboard。此处无需提前 return，否则会导致 SSR 丢失登录态并跳转至登录页。
      if (pathname.startsWith('/admin') && !isAdminRole(user.role)) {
        // 仅记录日志或执行其他非中断逻辑（可选）
      }

      // 通过上述校验后，附加上下文以供前端 SSR 中间件直接读取。
      event.context.user = {
        ...user,
        requirePasswordChange,
        hasSetPassword
      }
      return
    }

    // API 请求：将完整上下文附加到 event.context.user 以便 verify.get.ts
    // 等下游 handler 复用已解析的用户状态。
    event.context.user = {
      ...user,
      requirePasswordChange,
      hasSetPassword
    }

    // 强制改密拦截：未完成改密前，禁止访问除白名单外的所有 API
    // 这是后端硬性校验，防止技术用户绕过前端中间件直接调用接口
    const isAllowedDuringPasswordChange = PASSWORD_CHANGE_ALLOWED_PATHS.includes(pathname)

    if (!isAllowedDuringPasswordChange && requirePasswordChange) {
      return sendError(
        event,
        createError({
          statusCode: 403,
          message: '请先完成密码修改后再访问其他功能',
          data: { requirePasswordChange: true }
        })
      )
    }

    if (isUserBlocked(user.id)) {
      delete event.context.user
      const remaining = getUserBlockRemainingTime(user.id)
      return sendError(
        event,
        createError({
          statusCode: 401,
          message: `账户处于风险控制期，请在 ${remaining} 分钟后重试`
        })
      )
    }

    // 检查管理员专用路由
    if (pathname.startsWith('/api/admin') && !isAdminRole(user.role)) {
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
