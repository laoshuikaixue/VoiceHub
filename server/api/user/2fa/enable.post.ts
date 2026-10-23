import otplib from 'otplib'
const { authenticator } = otplib
import bcrypt from 'bcryptjs'
import { db, userIdentities, users, eq, and } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { getServerDate } from '~~/server/utils/serverTime'

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

  const isValid = authenticator.check(token, secret)
  if (!isValid) {
    throw createApiError(400, 'USER_CODE_INVALID', '验证码错误')
  }

  // 检查是否已存在
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  if (existing) {
    // 覆盖已有 TOTP 必须验证登录密码：仅凭会话即可换密钥会让 XSS/会话劫持者植入永久后门
    if (!password) {
      throw createApiError(400, 'USER_PASSWORD_REQUIRED', '请输入密码')
    }
    const [dbUser] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    if (!dbUser) {
      throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
    }
    const isPasswordValid = await bcrypt.compare(password, dbUser.password)
    if (!isPasswordValid) {
      throw createApiError(403, 'USER_PASSWORD_INCORRECT', '密码错误')
    }
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
      createdAt: getServerDate()
    })
  }

  return { success: true }
})
