import { parseState, getRedirectUri } from '~~/server/utils/oauth'
import { generateBindingToken } from '~~/server/utils/oauth-token'
import { db, eq, users, userIdentities } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { getOAuthStrategy } from '~~/server/utils/oauth-strategies'
import { isUserBlocked, getUserBlockRemainingTime } from '~~/server/services/securityService'
import {
  getOAuthBaseConfig,
  getProviderRuntimeConfig,
  isOAuthProviderEnabled,
  isSupportedOAuthProvider
} from '~~/server/services/oauthConfigService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getBeijingTime } from '~/utils/timeUtils'
import type { H3Event } from 'h3'
import { getRequestOrigin, isSecureRequest } from '~~/server/utils/request-utils'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  const query = getQuery(event)
  const code = query.code as string
  const stateStr = query.state as string

  if (!provider) {
    throw createError({ statusCode: 400, message: 'Missing provider' })
  }

  if (!isSupportedOAuthProvider(provider)) {
    throw createError({ statusCode: 400, message: '当前仅支持 GitHub / Casdoor / Google / 第三方 OAuth2' })
  }

  const enabled = await isOAuthProviderEnabled(provider)
  if (!enabled) {
    return sendRedirect(
      event,
      `/auth/error?code=PROVIDER_DISABLED&message=${encodeURIComponent('该 OAuth 登录方式未启用')}`
    )
  }

  if (!code || !stateStr) {
    throw createError({ statusCode: 400, message: 'Missing code or state' })
  }

  // 1. 验证 State
  const csrfCookie = getCookie(event, 'oauth_csrf')
  
  if (!csrfCookie) {
    throw createError({
      statusCode: 400,
      message: 'CSRF验证失败：Cookie丢失，请从登录页面重新开始'
    })
  }

  // 获取 Origin
  const origin = getRequestOrigin(event)

  const { stateSecret, redirectUriTemplate } = await getOAuthBaseConfig()
  const providerConfig = await getProviderRuntimeConfig(provider)

  const state = parseState(stateStr, origin, csrfCookie, stateSecret)
  if (!state) {
    throw createError({ statusCode: 400, message: 'Invalid or expired state' })
  }

  // 清除 CSRF cookie
  deleteCookie(event, 'oauth_csrf')

  const strategy = getOAuthStrategy(provider)
  const redirectUri = getRedirectUri(provider, redirectUriTemplate)

  // 2. 使用 Code 换取 Token
  let accessToken = ''
  try {
    accessToken = await strategy.exchangeToken(code, redirectUri, providerConfig)
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
    userInfo = await strategy.getUserInfo(accessToken, providerConfig)
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
  event: H3Event,
  provider: string,
  providerUserId: string,
  providerUsername: string
) {
  const isSecure = isSecureRequest(event)

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
      const currentUserRecord = await db.query.users.findFirst({
        where: eq(users.id, currentUser.userId)
      })

      if (!currentUserRecord || currentUserRecord.status !== 'active') {
        return sendRedirect(
          event,
          '/account?error=' + encodeURIComponent('当前账号状态异常，暂时无法绑定第三方账号')
        )
      }

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
        `/auth/error?code=ACCOUNT_WITHDRAWN&message=${encodeURIComponent('该账号已退学，限制访问')}`
      )
    }
    if (user.status === 'graduate') {
      return sendRedirect(
        event,
        `/auth/error?code=ACCOUNT_GRADUATED&message=${encodeURIComponent('该账号已毕业，限制访问')}`
      )
    }
    if (user.status !== 'active') {
      return sendRedirect(
        event,
        `/auth/error?code=ACCOUNT_DISABLED&message=${encodeURIComponent('该账号当前不可用')}`
      )
    }
    if (isUserBlocked(user.id)) {
      const remaining = getUserBlockRemainingTime(user.id)
      return sendRedirect(
        event,
        `/auth/error?code=ACCOUNT_BLOCKED&message=${encodeURIComponent(`账户处于风险控制期，请在 ${remaining} 分钟后重试`)}`
      )
    }

    await db
      .update(users)
      .set({
        lastLogin: getBeijingTime(),
        lastLoginIp: getClientIP(event)
      })
      .where(eq(users.id, user.id))

    const token = JWTEnhanced.generateToken(existingIdentity.user.id, existingIdentity.user.role)
    setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: isSecure,
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
      secure: isSecure,
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
