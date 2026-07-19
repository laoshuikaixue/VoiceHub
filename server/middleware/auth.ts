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

    return isProviderIndexPath || isProviderCallbackPath
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
  const isPublicApi = isPublicApiPath(pathname) || isOAuthProviderRoute
  if (
    shouldBypassPublicApiAuthentication(pathname, Boolean(token)) ||
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

    const requirePasswordChange = await resolveRequirePasswordChange(user)
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

    event.context.user = {
      ...user,
      requirePasswordChange,
      hasSetPassword: !!user.passwordChangedAt
    }

    // 认证完成前只允许维持登录态和完成改密所需的接口。
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
