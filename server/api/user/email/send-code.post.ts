import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SmtpService } from '~/server/services/smtpService'

// 简易验证码存储（如需分布式/重启持久，建议迁移到Redis）
const emailVerificationCodes = new Map<string, { code: string, userId: number, expiresAt: number }>()

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendEmailVerificationCode(userId: number, email: string, name?: string) {
  const code = generateCode()
  const expiresAt = Date.now() + 5 * 60 * 1000
  emailVerificationCodes.set(email, { code, userId, expiresAt })

  const smtp = SmtpService.getInstance()
  await smtp.initializeSmtpConfig()
  const html = smtp.generateEmailTemplate(
    '邮箱验证码',
    `<p>您好，${name || '用户'}！</p>
     <p>您正在验证邮箱：<strong>${email}</strong></p>
     <p>请在5分钟内输入以下验证码完成验证：</p>
     <h2 style="letter-spacing: 4px;">${code}</h2>
     <p style=\"color:#888\">若非本人操作，请忽略本邮件。</p>`
  )

  const sent = await smtp.sendMail(email, '邮箱验证码 | 校园广播站', html)
  if (!sent) {
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
  await db.update(users)
    .set({ email: emailRaw, emailVerified: false })
    .where(eq(users.id, user.id))

  // 发送邮件验证码
  await sendEmailVerificationCode(user.id, emailRaw, user.name)

  return { success: true, message: '验证码已发送，请查收邮箱' }
})

export { emailVerificationCodes }
