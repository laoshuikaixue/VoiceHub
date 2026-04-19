import bcrypt from 'bcryptjs'
import { db, eq, users, userIdentities } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
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

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body
  const bindingToken = getCookie(event, 'binding-token')

  if (!bindingToken) {
    throw createError({ statusCode: 400, message: '绑定会话已过期，请重新通过第三方登录发起' })
  }

  let payload
  try {
    payload = verifyBindingToken(bindingToken)
  } catch (e) {
    deleteCookie(event, 'binding-token')
    throw createError({ statusCode: 400, message: '无效的绑定令牌' })
  }

  const clientIp = getClientIP(event)

  // 验证用户凭据
  if (isAccountLocked(username)) {
    throw createError({ statusCode: 423, message: '账户已被锁定，请稍后重试' })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username)
  })

  if (!user) {
    recordLoginFailure(username, clientIp)
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    recordLoginFailure(username, clientIp)
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  if (user.status === 'withdrawn') {
    throw createError({ statusCode: 403, message: '该账号已退学，限制访问' })
  }

  if (user.status === 'graduate') {
    throw createError({ statusCode: 403, message: '该账号已毕业，限制访问' })
  }

  if (user.status !== 'active') {
    throw createError({ statusCode: 403, message: '该账号当前不可用' })
  }

  if (isUserBlocked(user.id)) {
    const remaining = getUserBlockRemainingTime(user.id)
    throw createError({ statusCode: 423, message: `账户处于风险控制期，请在 ${remaining} 分钟后重试` })
  }

  const totpIdentity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  if (totpIdentity) {
    const tempToken = JWTEnhanced.sign(
      {
        userId: user.id,
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
      const existing = await tx.query.userIdentities.findFirst({
        where: (t, { eq, and }) =>
          and(eq(t.provider, payload.provider), eq(t.providerUserId, payload.providerUserId))
      })

      if (existing) {
        if (existing.userId !== user.id) {
          throw createError({ statusCode: 409, message: '该第三方账号已被其他用户绑定' })
        }
        return
      }

      await tx.insert(userIdentities).values({
        userId: user.id,
        provider: payload.provider,
        providerUserId: payload.providerUserId,
        providerUsername: payload.providerUsername
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

  recordLoginSuccess(username, clientIp)

  await db
    .update(users)
    .set({
      lastLogin: getBeijingTime(),
      lastLoginIp: clientIp
    })
    .where(eq(users.id, user.id))

  // 登录
  const token = JWTEnhanced.generateToken(user.id, user.role)
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
