import { parseState, getRedirectUri } from '~~/server/utils/oauth'
import { generateBindingToken } from '~~/server/utils/oauth-token'
import { db, eq, userIdentities } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { getOAuthStrategy } from '~~/server/utils/oauth-strategies'
import { isUserBlocked, getUserBlockRemainingTime } from '~~/server/services/securityService'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  const query = getQuery(event)
  const code = query.code as string
  const stateStr = query.state as string

  if (!provider) {
    throw createError({ statusCode: 400, message: 'Missing provider' })
  }

  if (!code || !stateStr) {
    throw createError({ statusCode: 400, message: 'Missing code or state' })
  }

  // 1. 验证 State
  const csrfCookie = getCookie(event, 'oauth_csrf')

  // 获取 Origin
  const headers = getRequestHeaders(event)
  const protocol = headers['x-forwarded-proto'] || 'http'
  const host = headers['host']
  const origin = `${protocol}://${host}`

  const state = parseState(stateStr, origin, csrfCookie)
  if (!state) {
    throw createError({ statusCode: 400, message: 'Invalid or expired state' })
  }

  // 清除 CSRF cookie
  deleteCookie(event, 'oauth_csrf')

  const strategy = getOAuthStrategy(provider)
  const redirectUri = getRedirectUri(provider)

  // 2. 使用 Code 换取 Token
  let accessToken = ''
  try {
    accessToken = await strategy.exchangeToken(code, redirectUri)
  } catch (e: any) {
    console.error(`[OAuth] ${provider} token exchange failed:`, e.message)
    return sendRedirect(
      event,
      `/auth/error?code=TOKEN_EXCHANGE_FAILED&message=${encodeURIComponent('授权失败，无法获取访问令牌')}`
    )
  }

  // 3. 获取用户信息
  let userInfo
  try {
    userInfo = await strategy.getUserInfo(accessToken)
  } catch (e: any) {
    console.error(`[OAuth] ${provider} get user info failed:`, e.message)
    return sendRedirect(
      event,
      `/auth/error?code=USER_INFO_FAILED&message=${encodeURIComponent('获取用户信息失败')}`
    )
  }

  const providerUserId = userInfo.id
  const providerUsername = userInfo.username

  return handleUserLoginOrBind(event, provider, providerUserId, providerUsername)
})

async function handleUserLoginOrBind(
  event: any,
  provider: string,
  providerUserId: string,
  providerUsername: string
) {
  // 4. 检查是否已登录（绑定模式）
  const authToken = getCookie(event, 'auth-token')
  let currentUser: any = null
  if (authToken) {
    try {
      const payload = JWTEnhanced.verifyToken(authToken)
      currentUser = payload
    } catch (e) {
      // Token 无效或已过期，忽略
    }
  }

  // 5. 检查身份关联
  const existingIdentity = await db.query.userIdentities.findFirst({
    where: (t, { eq, and }) => and(eq(t.provider, provider), eq(t.providerUserId, providerUserId)),
    with: { user: true }
  })

  // 如果用户已登录，则是绑定操作
  if (currentUser) {
    if (existingIdentity) {
      // 已经被绑定
      if (existingIdentity.userId === currentUser.userId) {
        // 已经被当前用户绑定
        return sendRedirect(event, '/account?message=' + encodeURIComponent('账号已绑定'))
      } else {
        // 已经被其他用户绑定
        return sendRedirect(event, '/account?error=' + encodeURIComponent('该账号已被其他用户绑定'))
      }
    } else {
      // 未被绑定，直接绑定到当前用户
      await db.insert(userIdentities).values({
        userId: currentUser.userId,
        provider: provider,
        providerUserId: providerUserId,
        providerUsername: providerUsername,
        createdAt: new Date()
      })
      return sendRedirect(event, '/account?message=' + encodeURIComponent('绑定成功'))
    }
  }

  // 未登录，则是登录或新绑定流程
  if (existingIdentity && existingIdentity.user) {
    // 检查用户状态
    const user = existingIdentity.user
    if (user.status === 'withdrawn') {
      return sendRedirect(
        event,
        `/auth/error?code=ACCOUNT_WITHDRAWN&message=${encodeURIComponent('账号已注销')}`
      )
    }
    if (isUserBlocked(user.id)) {
      const remaining = getUserBlockRemainingTime(user.id)
      return sendRedirect(
        event,
        `/auth/error?code=ACCOUNT_BLOCKED&message=${encodeURIComponent(`账户处于风险控制期，请在 ${remaining} 分钟后重试`)}`
      )
    }

    // 登录
    const token = JWTEnhanced.generateToken(existingIdentity.user.id, existingIdentity.user.role)
    setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })
    return sendRedirect(event, '/')
  } else {
    // 绑定
    const bindingToken = generateBindingToken({
      provider: provider,
      providerUserId,
      providerUsername
    })

    // 将绑定令牌存入 cookie
    setCookie(event, 'binding-token', bindingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10分钟
      path: '/'
    })

    return sendRedirect(
      event,
      `/login?action=bind&provider=${provider}&username=${encodeURIComponent(providerUsername)}`
    )
  }
}
