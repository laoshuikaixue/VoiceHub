import { JWTEnhanced } from '../utils/jwt-enhanced'
import { db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { isUserBlocked, getUserBlockRemainingTime } from '../services/securityService'

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
    '/api/auth/verify', // verify端点自行处理token验证
    '/api/semesters/current',
    '/api/play-times',
    '/api/schedules/public',
    '/api/songs/count',
    '/api/songs/public',
    '/api/site-config',
    '/api/proxy/', // 代理API路径，用于图片代理等功能
    '/api/bilibili/', // 哔哩哔哩相关API
    '/api/native-api/', // Native Music 集成API
    '/api/system/location', // 系统位置检测API
    '/api/open/' // 开放API路径，由api-auth中间件处理认证
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
    // segments: ['', 'api', 'auth', 'provider', 'callback'?]
    const provider = segments[3]

    // 已知的受保护或非OAuth的Auth端点
    const nonOAuthEndpoints = [
      'identities',
      'logout',
      'change-password',
      'set-initial-password',
      'unbind',
      // login, bind, verify 已经在 publicApiPaths 中处理，这里列出是为了完整性或防止意外匹配
      'login',
      'bind',
      'verify'
    ]

    if (provider && !nonOAuthEndpoints.includes(provider)) {
      // 这是一个 OAuth 提供商路径 (例如 /api/auth/casdoor)
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
      const isSecure =
        getRequestURL(event).protocol === 'https:' ||
        getRequestHeader(event, 'x-forwarded-proto') === 'https'
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
        role: users.role
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1)

    const user = userResult[0] || null

    // 用户不存在时token无效
    if (!user) {
      return sendError(
        event,
        createError({
          statusCode: 401,
          message: '用户不存在，请重新登录'
        })
      )
    }

    event.context.user = user

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
