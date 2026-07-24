import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getClientIP } from '~~/server/utils/ip-utils'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  // 检查请求方法
  if (getMethod(event) !== 'POST') {
    throw createApiError(405, 'HTTP_METHOD_NOT_ALLOWED', '方法不被允许')
  }

  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  try {
    // 获取用户邮箱信息
    const userResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)

    const currentUser = userResult[0]

    if (!currentUser?.email) {
      throw createApiError(400, 'USER_BIND_EMAIL_FIRST', '请先绑定邮箱')
    }

    if (currentUser.emailVerified) {
      throw createApiError(400, 'USER_EMAIL_ALREADY_VERIFIED', '邮箱已验证，无需重新发送')
    }

    // 发送邮箱验证码
    try {
      const { sendEmailVerificationCode } = await import('~~/server/api/user/email/send-code.post')
      const clientIP = getClientIP(event)

      await sendEmailVerificationCode(currentUser.id, currentUser.email, currentUser.name, clientIP)

      return { success: true, message: '验证码已重新发送' }
    } catch (emailError) {
      console.error('发送邮箱验证码失败:', emailError)
      throw createApiError(500, 'USER_CODE_SEND_FAILED', '发送验证码失败，请稍后重试')
    }
  } catch (error: any) {
    console.error('重新发送验证邮件失败:', error)

    if (error?.statusCode) {
      throw error
    }

    throw createApiError(500, 'USER_RESEND_EMAIL_FAILED', '重新发送验证邮件失败')
  }
})
