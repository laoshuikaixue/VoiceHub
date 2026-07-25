import { db, users, eq } from '~/drizzle/db'
import { SmtpService } from '~~/server/services/smtpService'
import { getClientIP } from '~~/server/utils/ip-utils'
import {
  delStoreIfValue,
  getStore,
  hashStateCode,
  parseStoreJson,
  setStore
} from '~~/server/utils/captchaStore'

import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { randomInt } from 'crypto'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const { userId: reqUserId, token: rawToken, email } = await readBody(event)
  const token = rawToken || getCookie(event, 'pre-auth-token')

  // 必须提供预认证令牌
  if (!token) {
    throw createApiError(400, 'AUTH_MISSING_PRE_TOKEN', '缺少预认证令牌')
  }

  let userId: number
  try {
    const decoded = JWTEnhanced.verify(token) as any
    if (decoded.type !== 'pre-auth' || decoded.scope !== '2fa_pending') {
      throw new Error('无效的预认证令牌')
    }
    userId = decoded.userId
  } catch (e) {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
  }

  // 校验 userId 是否匹配
  if (!reqUserId || Number(reqUserId) !== userId) {
    throw createApiError(403, 'AUTH_USER_ID_MISMATCH', '非法操作：用户ID不匹配')
  }

  // 获取用户邮箱
  const userResult = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      name: users.name
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = userResult[0]
  // 增加 emailVerified 校验
  if (!user || !user.email || !user.emailVerified) {
    throw createApiError(400, 'AUTH_USER_NOT_FOUND_OR_NO_EMAIL', '用户不存在或未绑定邮箱')
  }

  // 校验用户输入的邮箱是否匹配
  if (!email || email.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw createApiError(400, 'AUTH_EMAIL_MISMATCH', '邮箱地址不匹配')
  }

  // 检查是否在冷却时间内
  const stateKey = `2fa-email:${userId}`
  const existingRaw = await getStore(stateKey)
  const existingCode = parseStoreJson<{ expiresAt: number }>(existingRaw)
  const now = getServerTimestamp()
  if (existingCode && Number.isFinite(existingCode.expiresAt) && existingCode.expiresAt > now) {
    // 5 * 60 * 1000 = 300000ms
    const totalDuration = 5 * 60 * 1000
    const timePassed = totalDuration - (existingCode.expiresAt - now)

    if (timePassed < 60 * 1000) {
      // 60秒冷却
      const remainingSeconds = Math.ceil((60000 - timePassed) / 1000)
      throw createApiError(429, 'AUTH_RATE_LIMITED_SECONDS', `操作过于频繁，请等待 ${remainingSeconds} 秒后再试`, { params: [remainingSeconds] })
    }
  }

  const code = randomInt(100000, 1000000).toString()
  const expiresAt = now + 5 * 60 * 1000
  const storedValue = JSON.stringify({
    codeHash: hashStateCode(stateKey, code),
    expiresAt
  })
  await setStore(stateKey, storedValue, 5 * 60)

  const clientIP = getClientIP(event)

  // 发送邮件
  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()

  let sent = false
  try {
    sent = await smtp.renderAndSend(
      user.email,
      'verification.code',
      {
        name: user.name || '用户',
        email: user.email,
        code,
        expiresInMinutes: 5,
        action: '登录验证'
      },
      clientIP
    )
  } catch (error) {
    await delStoreIfValue(stateKey, storedValue)
    throw error
  }

  if (!sent) {
    await delStoreIfValue(stateKey, storedValue)
    throw createApiError(500, 'AUTH_CODE_SEND_FAILED', '验证码发送失败')
  }

  return { success: true, message: '验证码已发送至您的邮箱' }
})
