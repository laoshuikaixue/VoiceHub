import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SmtpService } from '~/server/services/smtpService'

export default defineEventHandler(async (event) => {
  // 检查请求方法
  if (getMethod(event) !== 'POST') {
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
    // 获取用户邮箱信息
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    const currentUser = userResult[0]
    
    if (!currentUser?.email) {
      throw createError({
        statusCode: 400,
        message: '请先绑定邮箱'
      })
    }

    if (currentUser.emailVerified) {
      throw createError({
        statusCode: 400,
        message: '邮箱已验证，无需重新发送'
      })
    }

    // 发送验证邮件
    try {
      const smtpService = SmtpService.getInstance()
      await smtpService.initializeSmtpConfig()

      // 生成验证token
      const verificationToken = Buffer.from(`${user.id}:${currentUser.email}:${Date.now()}`).toString('base64')
      const verificationUrl = `${getRequestURL(event).origin}/verify-email?token=${verificationToken}`

      const emailContent = smtpService.generateEmailTemplate(
        '验证您的邮箱地址',
        `
          <p>您好，${user.name || '用户'}！</p>
          <p>您正在验证邮箱地址 <strong>${currentUser.email}</strong>。</p>
          <p>请点击下方按钮完成邮箱验证：</p>
        `,
        verificationUrl
      )

      await smtpService.sendMail(
        currentUser.email,
        '邮箱验证 | 校园广播站',
        emailContent
      )

      return {
        success: true,
        message: '验证邮件已重新发送'
      }
    } catch (emailError) {
      console.error('发送验证邮件失败:', emailError)
      throw createError({
        statusCode: 500,
        message: '发送验证邮件失败，请稍后重试'
      })
    }
  } catch (error) {
    console.error('重新发送验证邮件失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: '重新发送验证邮件失败'
    })
  }
})
