import { db, users, eq } from '~/drizzle/db'
import { twoFactorCodes } from '~~/server/utils/twoFactorStore'
import { SmtpService } from '~~/server/services/smtpService'
import { getClientIP } from '~~/server/utils/ip-utils'

import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { randomInt } from 'crypto'

export default defineEventHandler(async (event) => {
  const { userId: reqUserId, token, email } = await readBody(event)

  // 必须提供预认证令牌
  if (!token) {
    throw createError({ statusCode: 400, message: '缺少预认证令牌' })
  }

  let userId: number
  try {
    const decoded = JWTEnhanced.verify(token) as any
    if (decoded.type !== 'pre-auth' || decoded.scope !== '2fa_pending') {
      throw new Error('无效的预认证令牌')
    }
    userId = decoded.userId
  } catch (e) {
    throw createError({ statusCode: 401, message: '会话已失效，请重新登录' })
  }

  // 校验 userId 是否匹配
  if (!reqUserId || Number(reqUserId) !== userId) {
     throw createError({ statusCode: 403, message: '非法操作：用户ID不匹配' })
  }

  // 获取用户邮箱
  const userResult = await db.select({
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
    throw createError({ statusCode: 400, message: '用户不存在或未绑定邮箱' })
  }

  // 校验用户输入的邮箱是否匹配
  if (!email || email.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw createError({ statusCode: 400, message: '邮箱地址不匹配' })
  }

  const code = randomInt(100000, 999999).toString()
  twoFactorCodes.set(userId, { 
    code, 
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0 
  })

  const clientIP = getClientIP(event)

  // 发送邮件
  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()
  
  const sent = await smtp.renderAndSend(
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

  if (!sent) {
    throw createError({ statusCode: 500, message: '验证码发送失败' })
  }

  return { success: true, message: '验证码已发送至您的邮箱' }
})
