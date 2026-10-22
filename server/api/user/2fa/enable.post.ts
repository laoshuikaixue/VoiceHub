import otplib from 'otplib'
const { authenticator } = otplib
import bcrypt from 'bcryptjs'
import { db, userIdentities, eq, and, users } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { getClientIP } from '~~/server/utils/ip-utils'
import { consumePasswordRateLimit } from '~~/server/services/passwordSecurityService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const body = await readBody(event)
  const { token, secret, password } = body

  if (!token || !secret) {
    throw createApiError(400, 'USER_MISSING_CODE_OR_SECRET', '缺少验证码或密钥')
  }

  // 检查是否已存在
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  // 覆盖已有 TOTP 密钥 = 账号接管链路上的一步，必须二次验证密码。
  // 否则任何持有会话的人（如 XSS / 会话劫持）都能把密钥换成自己的，
  // 造成永久后门，且受害者毫无察觉。
  if (existing) {
    const clientIp = getClientIP(event)
    const limit = await consumePasswordRateLimit(user.id, clientIp, 'enable_2fa', 5)
    if (!limit.allowed) {
      throw createApiError(429, 'AUTH_RATE_LIMITED_MINUTES', '尝试过于频繁，请稍后再试')
    }

    if (!password) {
      throw createApiError(400, 'USER_PASSWORD_REQUIRED', '更换动态验证码密钥需要验证密码')
    }
    const [dbUser] = await db.select({ password: users.password }).from(users).where(eq(users.id, user.id)).limit(1)
    if (!dbUser || !(await bcrypt.compare(password, dbUser.password))) {
      throw createApiError(403, 'USER_PASSWORD_INCORRECT', '密码错误')
    }
  }

  const isValid = authenticator.check(token, secret)
  if (!isValid) {
    throw createApiError(400, 'USER_CODE_INVALID', '验证码错误')
  }

  if (existing) {
    // 更新密钥
    await db.update(userIdentities)
      .set({ providerUserId: secret })
      .where(eq(userIdentities.id, existing.id))
  } else {
    // 保存到数据库
    await db.insert(userIdentities).values({
      userId: user.id,
      provider: 'totp',
      providerUserId: secret,
      createdAt: new Date()
    })
  }

  return { success: true }
})
