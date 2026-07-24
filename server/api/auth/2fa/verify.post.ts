import { db, userIdentities, eq, and, users } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { getBeijingTime } from '~/utils/timeUtils'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import { isSecureRequest } from '~~/server/utils/request-utils'
import {
  delStore,
  delStoreIfValue,
  getStore,
  incrStore,
  parseStoreJson,
  verifyStateCode
} from '~~/server/utils/captchaStore'
import otplib from 'otplib'
import { createApiError } from '~~/server/utils/apiError'

const { authenticator } = otplib
const TOTP_FAILURE_LIMIT = 5
const TOTP_FAILURE_WINDOW_SECONDS = 5 * 60

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { code, type } = body
  const token = body.token || getCookie(event, 'pre-auth-token')

  if (!code || !type) {
    throw createApiError(400, 'AUTH_MISSING_REQUIRED_PARAMS', '缺少必要参数')
  }

  // 验证预认证临时令牌
  let targetUserId: number

  if (token) {
    try {
      const decoded = JWTEnhanced.verify(token) as any
      if (decoded.type !== 'pre-auth' || decoded.scope !== '2fa_pending') {
        throw new Error('无效的预认证令牌')
      }
      targetUserId = decoded.userId
    } catch (e) {
      deleteCookie(event, 'pre-auth-token')
      throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
    }
  } else {
    // 强制要求 Token
    throw createApiError(400, 'AUTH_MISSING_PRE_TOKEN_RELOGIN', '缺少预认证令牌，请重新登录')
  }

  // 获取用户信息
  const userResult = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)
  const user = userResult[0]
  if (!user) {
    throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
  }

  if (user.status !== 'active') {
    throw createApiError(403, 'AUTH_ACCOUNT_DISABLED_OR_RESTRICTED', '账号已被禁用或限制访问')
  }

  let verified = false
  const clientIp = getClientIP(event)
  const totpUserFailureKey = `2fa_totp_user:${targetUserId}`
  const totpIpFailureKey = `2fa_totp_ip:${clientIp}`

  if (type === 'totp') {
    const identity = await db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.userId, targetUserId), eq(userIdentities.provider, 'totp'))
    })
    if (!identity) {
      throw createApiError(400, 'AUTH_TOTP_NOT_ENABLED', '未开启TOTP验证')
    }

    // 先原子占用一次验证额度，防止并发请求同时绕过失败次数限制。
    const [userFailureCount, ipFailureCount] = await Promise.all([
      incrStore(totpUserFailureKey, TOTP_FAILURE_WINDOW_SECONDS),
      incrStore(totpIpFailureKey, TOTP_FAILURE_WINDOW_SECONDS)
    ])

    if (userFailureCount > TOTP_FAILURE_LIMIT || ipFailureCount > TOTP_FAILURE_LIMIT) {
      throw createApiError(429, 'AUTH_TOTP_TOO_MANY_ATTEMPTS', '动态验证码错误次数过多，请在 5 分钟后重试')
    }

    verified = authenticator.check(code, identity.providerUserId)

    if (!verified) {
      throw createApiError(400, 'AUTH_TOTP_CODE_INVALID', '动态验证码错误')
    }

    await delStore(totpUserFailureKey)
    await delStore(totpIpFailureKey)
  } else if (type === 'email') {
    const stateKey = `2fa-email:${targetUserId}`
    const storedRaw = await getStore(stateKey)
    const stored = parseStoreJson<{
      codeHash: string
      expiresAt: number
    }>(storedRaw)

    if (!stored || typeof stored.codeHash !== 'string' || !Number.isFinite(stored.expiresAt)) {
      if (storedRaw) await delStoreIfValue(stateKey, storedRaw)
      throw createApiError(400, 'AUTH_CODE_EXPIRED_OR_MISSING', '验证码已过期或不存在')
    }

    const now = getServerTimestamp()
    if (stored.expiresAt <= now) {
      await delStoreIfValue(stateKey, storedRaw!)
      throw createApiError(400, 'AUTH_CODE_EXPIRED', '验证码已过期')
    }

    const remainingTtl = Math.max(1, Math.ceil((stored.expiresAt - now) / 1000))
    const attemptKey = `${stateKey}:attempts:${stored.codeHash}`
    const attemptCount = await incrStore(attemptKey, remainingTtl)

    if (attemptCount > 5) {
      await delStoreIfValue(stateKey, storedRaw!)
      await delStore(attemptKey)
      throw createApiError(400, 'AUTH_TOO_MANY_VERIFY_ATTEMPTS', '验证尝试次数过多，请重新获取')
    }

    if (verifyStateCode(stateKey, String(code), stored.codeHash)) {
      if (!(await delStoreIfValue(stateKey, storedRaw!))) {
        throw createApiError(400, 'AUTH_CODE_ALREADY_USED', '验证码已使用，请重新获取')
      }
      await delStore(attemptKey)
      verified = true
    } else {
      if (attemptCount >= 5) {
        await delStoreIfValue(stateKey, storedRaw!)
        await delStore(attemptKey)
        throw createApiError(400, 'AUTH_TOO_MANY_VERIFY_ATTEMPTS', '验证尝试次数过多，请重新获取')
      }
      throw createApiError(400, 'AUTH_CODE_WRONG_ATTEMPTS_LEFT', `验证码错误，剩余尝试次数：${5 - attemptCount}`, { params: [5 - attemptCount] })
    }
  } else {
    throw createApiError(400, 'AUTH_UNSUPPORTED_VERIFICATION_TYPE', '不支持的验证类型')
  }

  // 验证通过，更新登录信息
  const bindingToken = getCookie(event, 'binding-token')
  if (bindingToken) {
    let bindingPayload
    try {
      bindingPayload = verifyBindingToken(bindingToken)
    } catch (e) {
      deleteCookie(event, 'binding-token')
      deleteCookie(event, 'pre-auth-token')
      throw createApiError(400, 'AUTH_BINDING_SESSION_INVALID', '绑定会话已失效，请重新发起绑定')
    }

    await db.transaction(async (tx) => {
      const existing = await tx.query.userIdentities.findFirst({
        where: (t, { eq, and }) =>
          and(
            eq(t.provider, bindingPayload.provider),
            eq(t.providerUserId, bindingPayload.providerUserId)
          )
      })

      if (existing && existing.userId !== user.id) {
        throw createApiError(409, 'AUTH_OAUTH_BOUND_OTHER_USER', '该第三方账号已被其他用户绑定')
      }

      if (!existing) {
        await tx.insert(userIdentities).values({
          userId: user.id,
          provider: bindingPayload.provider,
          providerUserId: bindingPayload.providerUserId,
          providerUsername: bindingPayload.providerUsername,
          createdAt: getBeijingTime()
        })
      }
    })
  }

  await db
    .update(users)
    .set({
      lastLogin: getBeijingTime(),
      lastLoginIp: clientIp
    })
    .where(eq(users.id, user.id))
    .catch((err) => console.error('Error updating user login info:', err))

  // 生成Token
  const authToken = JWTEnhanced.generateToken(user.id, user.role)

  const isSecure = isSecureRequest(event)

  setCookie(event, 'auth-token', authToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })

  deleteCookie(event, 'pre-auth-token')
  deleteCookie(event, 'binding-token')

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      grade: user.grade,
      class: user.class,
      role: user.role,
      needsPasswordChange: !user.passwordChangedAt,
      has2FA: true
    }
  }
})
