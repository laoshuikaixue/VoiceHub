import bcrypt from 'bcryptjs'
import { db, eq, users, userIdentities, systemSettings } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { createAuthSession } from '~~/server/utils/auth-session'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import {
  isAccountLocked,
  isUserBlocked,
  getUserBlockRemainingTime,
  recordLoginFailure,
  recordLoginSuccess
} from '~~/server/services/securityService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { and } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { isSecureRequest } from '~~/server/utils/request-utils'
import {
  computeRequirePasswordChange,
  resolveRequirePasswordChange
} from '~~/server/utils/system-settings-helper'
import { canBindOAuthIdentity } from '~~/server/utils/auth-route-policy'
import { createApiError } from '~~/server/utils/apiError'
import { syncOAuthIdentityAvatar } from '~~/server/utils/oauth-identity'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown> | null>(event)
  const username = typeof body?.username === 'string' ? body.username : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const bindingToken = getCookie(event, 'binding-token')

  if (!bindingToken) {
    throw createApiError(
      400,
      'AUTH_BINDING_SESSION_EXPIRED',
      '绑定会话已过期，请重新通过第三方登录发起'
    )
  }

  let payload
  try {
    payload = verifyBindingToken(bindingToken)
  } catch (e) {
    deleteCookie(event, 'binding-token')
    throw createApiError(400, 'AUTH_INVALID_BINDING_TOKEN', '无效的绑定令牌')
  }

  const clientIp = getClientIP(event)

  // 验证用户凭据
  if (await isAccountLocked(username)) {
    throw createApiError(423, 'AUTH_ACCOUNT_LOCKED', '账户已被锁定，请稍后重试')
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username)
  })

  if (!user) {
    await recordLoginFailure(username, clientIp)
    throw createApiError(401, 'AUTH_INVALID_CREDENTIALS', '用户名或密码错误')
  }

  const valid = !!user.password && (await bcrypt.compare(password, user.password))
  if (!valid) {
    await recordLoginFailure(username, clientIp)
    throw createApiError(401, 'AUTH_INVALID_CREDENTIALS', '用户名或密码错误')
  }

  if (user.status === 'withdrawn') {
    throw createApiError(403, 'AUTH_ACCOUNT_WITHDRAWN', '该账号已退学，限制访问')
  }

  if (user.status === 'graduate') {
    throw createApiError(403, 'AUTH_ACCOUNT_GRADUATED', '该账号已毕业，限制访问')
  }

  if (user.status !== 'active') {
    throw createApiError(403, 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE', '该账号当前不可用')
  }

  if (isUserBlocked(user.id)) {
    const remaining = getUserBlockRemainingTime(user.id)
    throw createApiError(
      423,
      'AUTH_ACCOUNT_RISK_CONTROL',
      `账户处于风险控制期，请在 ${remaining} 分钟后重试`,
      { params: [remaining] }
    )
  }

  if (!canBindOAuthIdentity(await resolveRequirePasswordChange(user))) {
    deleteCookie(event, 'binding-token')
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(
      403,
      'AUTH_PASSWORD_CHANGE_REQUIRED',
      '请先完成密码修改后再绑定第三方账号',
      { requirePasswordChange: true }
    )
  }

  const totpIdentity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  if (totpIdentity) {
    const tempToken = JWTEnhanced.sign(
      {
        userId: user.id,
        tokenVersion: user.tokenVersion,
        type: 'pre-auth',
        scope: '2fa_pending'
      },
      { expiresIn: '5m' }
    )
    const methods = ['totp']
    let maskedEmail = ''

    if (user.email && user.emailVerified) {
      methods.push('email')
      const [local, domain] = user.email.split('@')
      if (local && domain) {
        maskedEmail = local.length <= 2 ? `***@${domain}` : `${local.slice(0, 2)}****@${domain}`
      }
    }

    const isSecure = isSecureRequest(event)

    setCookie(event, 'pre-auth-token', tempToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 5,
      path: '/'
    })

    return {
      success: true,
      requires2FA: true,
      userId: user.id,
      methods,
      maskedEmail
    }
  }

  // 绑定
  try {
    await db.transaction(async (tx) => {
      const [currentUser] = await tx
        .select({
          id: users.id,
          tokenVersion: users.tokenVersion,
          forcePasswordChange: users.forcePasswordChange,
          passwordChangedAt: users.passwordChangedAt,
          avatarProvider: users.avatarProvider,
          avatarProviderUserId: users.avatarProviderUserId
        })
        .from(users)
        .where(eq(users.id, user.id))
        .for('update')

      if (!currentUser || currentUser.tokenVersion !== user.tokenVersion) {
        deleteCookie(event, 'binding-token')
        deleteCookie(event, 'pre-auth-token')
        throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
      }

      const [currentSettings] = await tx
        .select({
          forcePasswordChangeOnFirstLogin: systemSettings.forcePasswordChangeOnFirstLogin
        })
        .from(systemSettings)
        .limit(1)
        .for('share')
      const requirePasswordChange = computeRequirePasswordChange(
        currentUser,
        currentSettings?.forcePasswordChangeOnFirstLogin ?? false
      )

      if (!canBindOAuthIdentity(requirePasswordChange)) {
        deleteCookie(event, 'binding-token')
        deleteCookie(event, 'pre-auth-token')
        throw createApiError(
          403,
          'AUTH_PASSWORD_CHANGE_REQUIRED',
          '请先完成密码修改后再绑定第三方账号',
          { requirePasswordChange: true }
        )
      }

      const existing = await tx.query.userIdentities.findFirst({
        where: (t, { eq, and }) =>
          and(eq(t.provider, payload.provider), eq(t.providerUserId, payload.providerUserId))
      })

      if (existing && existing.userId !== user.id) {
        throw createApiError(409, 'AUTH_OAUTH_BOUND_OTHER_USER', '该第三方账号已被其他用户绑定')
      }

      await syncOAuthIdentityAvatar(tx, currentUser, existing, {
        provider: payload.provider,
        providerUserId: payload.providerUserId,
        providerUsername: payload.providerUsername,
        avatar: payload.avatar
      })
    })
  } catch (e: any) {
    // 如果用户尝试再次绑定相同的账户，处理唯一约束违规
    if (e.code === '23505') {
      // Postgres 唯一性冲突
      // 这意味着身份已经绑定，这是正常情况。
      // 我们可以继续执行登录流程。
    } else {
      // 绑定失败，清除 cookie 防止重放，或者保留允许重试？
      // 如果是系统错误，保留 cookie 可能更好。
      // 但如果是逻辑错误，应该清除。
      // 这里我们选择抛出错误，前端处理。
      throw e
    }
  }

  await recordLoginSuccess(username, clientIp)

  await db
    .update(users)
    .set({
      lastLogin: getBeijingTime(),
      lastLoginIp: clientIp
    })
    .where(eq(users.id, user.id))

  // 登录
  const { token } = await createAuthSession(event, user, payload.provider || 'oauth')
  const isSecure = isSecureRequest(event)
  setCookie(event, 'auth-token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })

  // 清除绑定令牌
  deleteCookie(event, 'binding-token')
  deleteCookie(event, 'pre-auth-token')

  return { success: true }
})
