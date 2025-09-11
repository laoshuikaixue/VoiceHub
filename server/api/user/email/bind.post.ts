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
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0 && existingUser[0].id !== user.id) {
      throw createError({
        statusCode: 400,
        message: '该邮箱已被其他用户绑定'
      })
    }

    // 更新用户邮箱
    await db.update(users)
      .set({
        email: email,
        emailVerified: false,
        emailVerifiedAt: null
      })
      .where(eq(users.id, user.id))

    // 发送验证邮件
    try {
      const smtpService = SmtpService.getInstance()
      await smtpService.initializeSmtpConfig()

      // 生成验证token（这里简化处理，实际应该使用JWT或其他安全token）
      const verificationToken = Buffer.from(`${user.id}:${email}:${Date.now()}`).toString('base64')
      const verificationUrl = `${getRequestURL(event).origin}/verify-email?token=${verificationToken}`

      const emailContent = smtpService.generateEmailTemplate(
        '验证您的邮箱地址',
        `
          <p>您好，${user.name || '用户'}！</p>
          <p>您正在绑定邮箱地址 <strong>${email}</strong> 到您的校园广播站账号。</p>
          <p>请点击下方按钮完成邮箱验证：</p>
        `,
        verificationUrl
      )

      await smtpService.sendMail(
        email,
        '邮箱验证 | 校园广播站',
        emailContent
      )
    } catch (emailError) {
      console.error('发送验证邮件失败:', emailError)
      // 即使邮件发送失败，也不要回滚邮箱绑定，用户可以重新发送
    }

    return {
      success: true,
      message: '验证邮件已发送，请查收邮件并点击验证链接'
    }
  } catch (error) {
    console.error('绑定邮箱失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: '绑定邮箱失败'
    })
  }
})
