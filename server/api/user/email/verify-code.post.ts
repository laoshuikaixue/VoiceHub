import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { emailVerificationCodes } from './send-code.post'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }

  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const email = (body?.email || '').toString().trim().toLowerCase()
  const code = (body?.code || '').toString().trim()

  if (!email || !code) {
    throw createError({ statusCode: 400, message: '邮箱与验证码不能为空' })
  }

  const record = emailVerificationCodes.get(email)
  if (!record || record.userId !== user.id) {
    throw createError({ statusCode: 400, message: '请先发送验证码' })
  }
  if (Date.now() > record.expiresAt) {
    emailVerificationCodes.delete(email)
    throw createError({ statusCode: 400, message: '验证码已过期，请重新发送' })
  }
  if (record.code !== code) {
    throw createError({ statusCode: 400, message: '验证码错误' })
  }

  // 验证通过：设置邮箱为已验证
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id))

  emailVerificationCodes.delete(email)

  return { success: true, message: '邮箱验证成功' }
})
