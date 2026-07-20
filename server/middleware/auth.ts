import { JWTEnhanced } from '../utils/jwt-enhanced'
import type { H3Event } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isUserBlocked, getUserBlockRemainingTime } from '../services/securityService'
import { isSupportedOAuthProvider } from '../services/oauthConfigService'
import { isSecureRequest } from '../utils/request-utils'
import { resolveRequirePasswordChange } from '../utils/system-settings-helper'
import {
  isPublicApiPath,
  shouldBlockDuringPasswordChange,
  shouldBypassPublicApiAuthentication
} from '../utils/auth-route-policy'
import { getPasswordSetupState } from '../utils/initial-password-policy'

function clearAuthCookie(event: H3Event) {
  setCookie(event, 'auth-token', '', {
    httpOnly: true,
    secure: isSecureRequest(event),
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
}

export default defineEventHandler(async (event) => {
  // 清除用户上下文
  if (event.context.user) {
    delete event.context.user
  }

  const url = getRequestURL(event)
  const pathname = url.pathname
  const method = event.method.toUpperCase()

  // 跳过非API路由
  if (!pathname.startsWith('/api/')) {
    return
  }

  // 动态判断 OAuth 路径
  // 允许 /api/auth/[provider] 和 /api/auth/[provider]/callback
  // 但排除已知的受保护/特定 Auth 端点
  const isOAuthProviderRoute = (() => {
    if (!pathname.startsWith('/api/auth/')) return false
    const segments = pathname.split('/')
    const provider = segments[3]
    const isProviderIndexPath = segments.length === 4 && isSupportedOAuthProvider(provider || '')
    const isProviderCallbackPath =
      segments.length === 5 &&
      segments[4] === 'callback' &&
      isSupportedOAuthProvider(provider || '')

    return method === 'GET' && (isProviderIndexPath || isProviderCallbackPath)
  })()

  // 从请求头或cookie获取token
  let token: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  if (!token) {
    token = getCookie(event, 'auth-token') || null
  }

  // 公共接口只有匿名访问时才绕过认证；携带登录态必须继续检查强制改密状态。
  // OAuth 路由只有匿名启动/回调时公开；携带登录态时仍必须经过强制改密门控。
  const isPublicApi = isPublicApiPath(pathname, method)
  if (
    shouldBypassPublicApiAuthentication(pathname, method, Boolean(token)) ||
    (isOAuthProviderRoute && !token)
  ) {
    return
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
        password: users.password,
        passwordChangedAt: users.passwordChangedAt,
        forcePasswordChange: users.forcePasswordChange,
        tokenVersion: users.tokenVersion,
        email: users.email,
        emailVerified: users.emailVerified
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1)

    const user = userResult[0] || null

    // 用户不存在或状态异常时token无效
    if (!user || user.status !== 'active') {
      clearAuthCookie(event)

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

    // 用户级版本号可以可靠撤销同一秒内签发的旧令牌。
    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      clearAuthCookie(event)

      return sendError(
        event,
        createError({
          statusCode: 401,
          message: '登录状态已失效，请重新登录',
          data: { invalidToken: true, passwordChanged: true }
        })
      )
    }

    // 兼容迁移前签发的令牌，继续检查密码修改时间。
    if (user.passwordChangedAt && decoded.iat) {
      const passwordChangedTime = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
      if (decoded.iat < passwordChangedTime) {
        clearAuthCookie(event)

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

    let requirePasswordChange = false
    try {
      requirePasswordChange = await resolveRequirePasswordChange(user)
    } catch (error) {
      // 配置依赖故障时放行核心请求，避免缓存或数据库抖动造成全站重定向雪崩。
      console.error('[Auth] 读取强制改密策略失败，按放行策略降级:', error)
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

    const passwordSetupState = getPasswordSetupState(user, requirePasswordChange)
    event.context.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      grade: user.grade,
      class: user.class,
      role: user.role,
      status: user.status,
      passwordChangedAt: user.passwordChangedAt,
      forcePasswordChange: user.forcePasswordChange,
      tokenVersion: user.tokenVersion,
      email: user.email,
      emailVerified: user.emailVerified,
      requirePasswordChange,
      ...passwordSetupState
    }

    // 认证完成前只允许维持登录态和完成改密所需的接口。
    if (shouldBlockDuringPasswordChange(pathname, method, requirePasswordChange)) {
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
    // 携带失效登录态访问公共接口时仍按匿名请求处理，避免破坏公共功能。
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
