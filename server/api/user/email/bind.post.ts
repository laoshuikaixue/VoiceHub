import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查请求方法
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      message: '方法不被允许'
    })
  }

  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  try {
    const body = await readBody(event)

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!body.email || !emailRegex.test(body.email)) {
      throw createError({
        statusCode: 400,
        message: '请输入有效的邮箱地址'
      })
    }

    const email = body.email.trim().toLowerCase()

    // 检查邮箱是否已被其他用户绑定
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (existingUser.length > 0 && existingUser[0].id !== user.id) {
      throw createError({
        statusCode: 400,
        message: '该邮箱已被其他用户绑定'
      })
    }

    // 更新用户邮箱
    await db
      .update(users)
      .set({
        email: email,
        emailVerified: false
      })
      .where(eq(users.id, user.id))

    // 发送邮箱验证码
    try {
      const { sendEmailVerificationCode } = await import('~~/server/api/user/email/send-code.post')
      const { getClientIP } = await import('~~/server/utils/ip-utils')
      const clientIP = getClientIP(event)

      await sendEmailVerificationCode(user.id, email, user.name, clientIP)
    } catch (emailError) {
      console.error('发送邮箱验证码失败:', emailError)
    }

    return {
      success: true,
      message: '验证码已发送，请查收邮箱并输入验证码完成验证'
    }
  } catch (error: any) {
    console.error('绑定邮箱失败:', error)

    if (error?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '绑定邮箱失败'
    })
  }
})
