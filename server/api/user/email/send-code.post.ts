import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SmtpService } from '~~/server/services/smtpService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { delStore, hashStateCode, setStore } from '~~/server/utils/captchaStore'

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendEmailVerificationCode(
  userId: number,
  email: string,
  name?: string,
  ipAddress?: string
) {
  const code = generateCode()
  const expiresAt = getServerTimestamp() + 5 * 60 * 1000
  const stateKey = `email-verify:${userId}`
  await setStore(
    stateKey,
    JSON.stringify({
      email,
      codeHash: hashStateCode(stateKey, code),
      expiresAt
    }),
    5 * 60
  )

  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()
  let sent = false
  try {
    sent = await smtp.renderAndSend(
      email,
      'verification.code',
      {
        name: name || '用户',
        email,
        code,
        expiresInMinutes: 5
      },
      ipAddress
    )
  } catch (error) {
    await delStore(stateKey)
    throw error
  }
  if (!sent) {
    await delStore(stateKey)
    throw createError({ statusCode: 500, message: '验证码发送失败，请稍后重试' })
  }
}

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }

  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const emailRaw = (body?.email || '').toString().trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRaw || !emailRegex.test(emailRaw)) {
    throw createError({ statusCode: 400, message: '请输入有效的邮箱地址' })
  }

  // 确认邮箱未被其他用户占用
  const existing = await db.select().from(users).where(eq(users.email, emailRaw)).limit(1)
  if (existing.length > 0 && existing[0].id !== user.id) {
    throw createError({ statusCode: 400, message: '该邮箱已被其他用户绑定' })
  }

  // 写入/更新邮箱，标记未验证
  await db.update(users).set({ email: emailRaw, emailVerified: false }).where(eq(users.id, user.id))

  // 获取客户端IP地址
  const clientIP = getClientIP(event)

  // 发送邮件验证码
  await sendEmailVerificationCode(user.id, emailRaw, user.name, clientIP)

  return { success: true, message: '验证码已发送，请查收邮箱' }
})
