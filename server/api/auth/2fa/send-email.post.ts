import { db, users, eq } from '~/drizzle/db'
import { twoFactorCodes } from '~~/server/utils/twoFactorStore'
import { SmtpService } from '~~/server/services/smtpService'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = body.userId

  if (!userId) {
     throw createError({ statusCode: 400, message: '缺少用户ID' })
  }

  // 获取用户邮箱
  const userResult = await db.select({
      id: users.id,
      email: users.email,
      name: users.name
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = userResult[0]
  if (!user || !user.email) {
    throw createError({ statusCode: 400, message: '用户不存在或未绑定邮箱' })
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  twoFactorCodes.set(userId, { code, expiresAt: Date.now() + 5 * 60 * 1000 })

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
