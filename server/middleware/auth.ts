import { JWTEnhanced } from '../utils/jwt-enhanced'
import { db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { isUserBlocked, getUserBlockRemainingTime } from '../services/securityService'
import { isSupportedOAuthProvider } from '../services/oauthConfigService'
import { isSecureRequest } from '../utils/request-utils'
import {
  getForcePasswordChangeOnFirstLogin,
  computeRequirePasswordChange
} from '../utils/system-settings-helper'

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

export default defineEventHandler(async (event) => {
  // 清除用户上下文
  if (event.context.user) {
    delete event.context.user
  }

  const url = getRequestURL(event)
  const pathname = url.pathname

  // 跳过非API路由
  if (!pathname.startsWith('/api/')) {
    return
  }

  // 公共API路径
  const publicApiPaths = [
    '/api/auth/login',
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

  // 从请求头或cookie获取token
  let token: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }

  // 受保护路由缺少token时返回401错误
  if (!token) {
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

    event.context.user = user

    // 强制改密拦截：未完成改密前，禁止访问除白名单外的所有 API
    // 这是后端硬性校验，防止技术用户绕过前端中间件直接调用接口
    const isAllowedDuringPasswordChange = PASSWORD_CHANGE_ALLOWED_PATHS.includes(pathname)

    if (!isAllowedDuringPasswordChange) {
      // 性能优化：先检查本地字段，避免大部分正常请求触发异步查询
      // 1. 管理员显式设置 forcePasswordChange=true → 直接拦截
      // 2. 用户已设置过密码且未被显式强制 → 无需改密，跳过
      // 3. 仅当用户从未设置过密码时，才查询全局开关
      let requirePasswordChange = false

      if (user.forcePasswordChange) {
        requirePasswordChange = true
      } else if (!user.passwordChangedAt) {
        const forcePasswordChangeOnFirstLogin = await getForcePasswordChangeOnFirstLogin()
        requirePasswordChange = forcePasswordChangeOnFirstLogin
      }

      if (requirePasswordChange) {
        return sendError(
          event,
          createError({
            statusCode: 403,
            message: '请先完成密码修改后再访问其他功能',
            data: { requirePasswordChange: true }
          })
        )
      }
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
    if (
      pathname.startsWith('/api/admin') &&
      !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)
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
