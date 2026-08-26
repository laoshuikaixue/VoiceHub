import {
  decodeOAuthStateCookie,
  getOAuthStateCookieNames,
  LEGACY_OAUTH_STATE_COOKIE_NAMES,
  parseState,
  getRedirectUri,
  getSafeOAuthReturnPath,
  verifyCompactOAuthState
} from '~~/server/utils/oauth'
import { generateBindingToken } from '~~/server/utils/oauth-token'
import { db, eq, users, systemSettings } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { createAuthSession } from '~~/server/utils/auth-session'
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
import { createApiError } from '~~/server/utils/apiError'
import { computeRequirePasswordChange } from '~~/server/utils/system-settings-helper'
import { canBindOAuthIdentity } from '~~/server/utils/auth-route-policy'
import { syncOAuthIdentityAvatar } from '~~/server/utils/oauth-identity'

const getSingleQueryValue = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined
}

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  const query = getQuery(event)
  // OAuth 回调参数参与身份与 CSRF 校验，拒绝重复参数可避免上下游解析结果不一致。
  const code = getSingleQueryValue(query.code)
  const stateStr = getSingleQueryValue(query.state)
  const callbackLoginType = getSingleQueryValue(query.type)?.trim().toLowerCase()

  if (!provider) {
    throw createApiError(400, 'AUTH_MISSING_PROVIDER', 'Missing provider')
  }

  if (!isSupportedOAuthProvider(provider)) {
    throw createApiError(400, 'AUTH_UNSUPPORTED_OAUTH_PROVIDER', '当前仅支持 GitHub / Casdoor / Google / 聚合登陆 / 第三方 OAuth2')
  }

  const enabled = await isOAuthProviderEnabled(provider)
  if (!enabled) {
    return sendRedirect(
      event,
      `/auth/error?code=PROVIDER_DISABLED&message=${encodeURIComponent('该 OAuth 登录方式未启用')}`
    )
  }

  if (!code) {
    throw createApiError(400, 'AUTH_MISSING_CODE_OR_STATE', 'OAuth 回调缺少或包含冲突的 code 参数')
  }
  if (!stateStr) {
    throw createApiError(400, 'AUTH_MISSING_CODE_OR_STATE', 'OAuth 回调缺少或包含冲突的 state 参数，无法完成安全验证')
  }

  // 1. 验证 State
  const stateCookieNames = getOAuthStateCookieNames(provider === 'aggregate' ? stateStr : undefined)
  let activeStateCookieNames = stateCookieNames
  let csrfCookie = getCookie(event, activeStateCookieNames.csrf)
  let storedFullState = getCookie(event, activeStateCookieNames.fullState)
  let storedCompactState = getCookie(event, activeStateCookieNames.compactState)

  // 兼容升级前已经发起、仍在十分钟有效期内的登录流程。
  // 仅在新命名 Cookie 全部缺失时才回退，避免部分丢失时连同有效的新命名 Cookie 一起被丢弃。
  if (provider === 'aggregate' && !csrfCookie && !storedFullState && !storedCompactState) {
    activeStateCookieNames = LEGACY_OAUTH_STATE_COOKIE_NAMES
    csrfCookie = getCookie(event, activeStateCookieNames.csrf)
    storedFullState = getCookie(event, activeStateCookieNames.fullState)
    storedCompactState = getCookie(event, activeStateCookieNames.compactState)
  }

  // 验证失败时同时清理两套命名下的残留 Cookie，避免无效状态干扰后续流程
  const cleanupStateCookies = () => {
    const names = new Set([
      stateCookieNames.csrf,
      LEGACY_OAUTH_STATE_COOKIE_NAMES.csrf,
      ...(provider === 'aggregate'
        ? [
            stateCookieNames.fullState,
            stateCookieNames.compactState,
            LEGACY_OAUTH_STATE_COOKIE_NAMES.fullState,
            LEGACY_OAUTH_STATE_COOKIE_NAMES.compactState
          ]
        : [])
    ])
    for (const name of names) {
      deleteCookie(event, name, { path: '/' })
    }
  }

  if (!csrfCookie) {
    cleanupStateCookies()
    throw createApiError(400, 'AUTH_CSRF_COOKIE_MISSING', 'CSRF验证失败：Cookie丢失，请从登录页面重新开始')
  }

  // 获取 Origin
  const origin = getRequestOrigin(event)

  const { stateSecret, redirectUriTemplate } = await getOAuthBaseConfig()
  const providerConfig = await getProviderRuntimeConfig(provider)
  let stateToVerify = stateStr

  if (provider === 'aggregate') {
    // Cookie 比对确认回调属于本流程，HMAC 验签阻止伪造的 state
    if (
      !storedFullState ||
      !storedCompactState ||
      storedCompactState !== stateStr ||
      !verifyCompactOAuthState(stateStr, stateSecret)
    ) {
      cleanupStateCookies()
      throw createApiError(400, 'AUTH_AGGREGATED_STATE_INVALID', '聚合登录状态无效或已过期')
    }
    stateToVerify = decodeOAuthStateCookie(storedFullState)
    if (!stateToVerify) {
      cleanupStateCookies()
      throw createApiError(400, 'AUTH_AGGREGATED_STATE_INVALID', '聚合登录状态无效或已过期')
    }
  }

  const state = parseState(stateToVerify, origin, csrfCookie, stateSecret)
  if (!state) {
    cleanupStateCookies()
    throw createApiError(400, 'AUTH_STATE_INVALID', 'Invalid or expired state')
  }
  if (state.provider && state.provider !== provider) {
    throw createApiError(400, 'AUTH_OAUTH_PROVIDER_STATE_MISMATCH', 'OAuth provider 与 state 不匹配')
  }

  let identityProvider: string = provider
  if (provider === 'aggregate') {
    const loginType = state.loginType?.trim().toLowerCase()
    if (!loginType || !providerConfig.loginTypes?.includes(loginType)) {
      throw createApiError(400, 'AUTH_AGGREGATED_METHOD_CHANGED', '聚合登录方式未启用或已变更')
    }
    if (callbackLoginType !== loginType) {
      throw createApiError(400, 'AUTH_AGGREGATED_CALLBACK_STATE_MISMATCH', '聚合登录回调类型与 state 不匹配')
    }
    providerConfig.loginType = loginType
    identityProvider = `aggregate:${loginType}`
  }

  // 清除 CSRF cookie
  deleteCookie(event, activeStateCookieNames.csrf, { path: '/' })
  if (provider === 'aggregate') {
    deleteCookie(event, activeStateCookieNames.fullState, { path: '/' })
    deleteCookie(event, activeStateCookieNames.compactState, { path: '/' })
  }

  const strategy = getOAuthStrategy(provider)
  const redirectUri = getRedirectUri(provider, redirectUriTemplate)

  // 2. 使用 Code 换取 Token
  let accessToken: string
  try {
    accessToken = await strategy.exchangeToken(code, redirectUri, providerConfig)
  } catch (e: any) {
    console.error(`[OAuth] ${provider} token exchange failed:`, e.message)
    const errorMessage =
      provider === 'aggregate' && typeof e?.message === 'string' && e.message.trim()
        ? `聚合登录授权失败：${e.message.trim()}`
        : '授权失败，无法获取访问令牌'
    return sendRedirect(
      event,
      `/auth/error?code=TOKEN_EXCHANGE_FAILED&message=${encodeURIComponent(errorMessage)}`
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

  return handleUserLoginOrBind(
    event,
    identityProvider,
    providerUserId,
    providerUsername,
    state.returnTo,
    userInfo.avatar
  )
})

async function handleUserLoginOrBind(
  event: H3Event,
  provider: string,
  providerUserId: string,
  providerUsername: string,
  returnTo?: string,
  avatar?: string
) {
  const isSecure = isSecureRequest(event)
  const safeReturnTo = getSafeOAuthReturnPath(returnTo)

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
    let bindingResult:
      | 'success'
      | 'already-bound'
      | 'bound-to-other'
      | 'invalid-session'
      | 'inactive'
      | 'password-change-required'

    try {
      bindingResult = await db.transaction(async (tx) => {
        const [currentUserRecord] = await tx
          .select({
            id: users.id,
            status: users.status,
            tokenVersion: users.tokenVersion,
            forcePasswordChange: users.forcePasswordChange,
            passwordChangedAt: users.passwordChangedAt,
            avatarProvider: users.avatarProvider,
            avatarProviderUserId: users.avatarProviderUserId
          })
          .from(users)
          .where(eq(users.id, currentUser.userId))
          .for('update')

        if (
          !currentUserRecord ||
          // 兼容迁移前签发的无版本号令牌，按版本 0 参与比对，与全局认证中间件语义一致
          (currentUser.tokenVersion ?? 0) !== currentUserRecord.tokenVersion
        ) {
          return 'invalid-session'
        }

        if (currentUserRecord.status !== 'active') {
          return 'inactive'
        }

        const [currentSettings] = await tx
          .select({
            forcePasswordChangeOnFirstLogin: systemSettings.forcePasswordChangeOnFirstLogin
          })
          .from(systemSettings)
          .limit(1)
          .for('share')
        const requirePasswordChange = computeRequirePasswordChange(
          currentUserRecord,
          currentSettings?.forcePasswordChangeOnFirstLogin ?? false
        )

        if (!canBindOAuthIdentity(requirePasswordChange)) {
          return 'password-change-required'
        }

        const identity = await tx.query.userIdentities.findFirst({
          where: (t, { eq, and }) =>
            and(eq(t.provider, provider), eq(t.providerUserId, providerUserId))
        })

        if (identity) {
          if (identity.userId !== currentUser.userId) {
            return 'bound-to-other'
          }
          await syncOAuthIdentityAvatar(tx, currentUserRecord, identity, {
            provider,
            providerUserId,
            providerUsername,
            avatar
          })
          return 'already-bound'
        }

        await syncOAuthIdentityAvatar(tx, currentUserRecord, null, {
          provider,
          providerUserId,
          providerUsername,
          avatar
        })
        return 'success'
      })
    } catch (error: any) {
      if (error?.code !== '23505') {
        console.error('[OAuth] 绑定第三方账号失败:', error)
        return sendRedirect(
          event,
          '/account?error=' + encodeURIComponent('绑定第三方账号失败，请稍后重试')
        )
      }

      const concurrentIdentity = await db.query.userIdentities.findFirst({
        where: (t, { eq, and }) =>
          and(eq(t.provider, provider), eq(t.providerUserId, providerUserId))
      })
      bindingResult =
        concurrentIdentity?.userId === currentUser.userId ? 'already-bound' : 'bound-to-other'
    }

    if (bindingResult === 'success') {
      return sendRedirect(event, '/account?message=' + encodeURIComponent('绑定成功'))
    }
    if (bindingResult === 'already-bound') {
      return sendRedirect(event, '/account?message=' + encodeURIComponent('账号已绑定'))
    }
    if (bindingResult === 'bound-to-other') {
      return sendRedirect(event, '/account?error=' + encodeURIComponent('该账号已被其他用户绑定'))
    }
    if (bindingResult === 'password-change-required') {
      return sendRedirect(
        event,
        '/change-password?error=' + encodeURIComponent('请先完成密码修改后再绑定第三方账号')
      )
    }
    if (bindingResult === 'invalid-session') {
      deleteCookie(event, 'auth-token')
      return sendRedirect(event, '/login?error=' + encodeURIComponent('会话已失效，请重新登录'))
    }

    return sendRedirect(
      event,
      '/account?error=' + encodeURIComponent('当前账号状态异常，暂时无法绑定第三方账号')
    )
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
    if (user.status === 'pending') {
      return sendRedirect(
        event,
        `/auth/error?code=ACCOUNT_PENDING_APPROVAL&message=${encodeURIComponent('账号待管理员审核，请耐心等待')}`
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

    await db.transaction(async (tx) => {
      const [userRecord] = await tx
        .select({
          id: users.id,
          avatarProvider: users.avatarProvider,
          avatarProviderUserId: users.avatarProviderUserId
        })
        .from(users)
        .where(eq(users.id, user.id))
        .for('update')

      if (!userRecord) {
        throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
      }

      await syncOAuthIdentityAvatar(tx, userRecord, existingIdentity, {
        provider,
        providerUserId,
        providerUsername,
        avatar
      })

      await tx
        .update(users)
        .set({
          lastLogin: getBeijingTime(),
          lastLoginIp: getClientIP(event)
        })
        .where(eq(users.id, user.id))
    })

    const { token } = await createAuthSession(event, existingIdentity.user, provider)
    setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })
    return sendRedirect(event, safeReturnTo || '/')
  } else {
    // 绑定
    const bindingToken = generateBindingToken({
      provider: provider,
      providerUserId,
      providerUsername,
      avatar
    })

    // 将绑定令牌存入 cookie
    setCookie(event, 'binding-token', bindingToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 10, // 10分钟
      path: '/'
    })

    const redirectQuery = safeReturnTo ? `&redirect=${encodeURIComponent(safeReturnTo)}` : ''
    return sendRedirect(
      event,
      `/login?action=bind&provider=${encodeURIComponent(provider)}&username=${encodeURIComponent(providerUsername)}${redirectQuery}`
    )
  }
}
