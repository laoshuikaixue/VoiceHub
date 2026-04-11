import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SmtpService } from '~~/server/services/smtpService'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, email } = body

  if (!username || !email) {
    throw createError({ statusCode: 400, message: '请提供账号名和邮箱地址' })
  }

  try {
    const userResult = await db.select().from(users).where(eq(users.username, username)).limit(1)
    const user = userResult[0]

    // 为了防止恶意枚举账号，无论是否匹配，都返回相同的成功提示
    if (user && user.email && user.email.toLowerCase() === email.toLowerCase()) {
      const payload = {
        type: 'password_reset',
        userId: user.id,
        hash: user.password // 密码哈希，一旦密码被修改，旧链接立即失效
      }
      // 令牌15分钟有效
      const token = JWTEnhanced.sign(payload, { expiresIn: '15m' })

      const host = getRequestHeader(event, 'host')
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const forwardedProto = getRequestHeader(event, 'x-forwarded-proto')
      const finalProtocol = forwardedProto || protocol
      
      const resetLink = `${finalProtocol}://${host}/reset-password?token=${token}`

      const clientIP = getClientIP(event)
      const smtp = SmtpService.getInstance()
      
      // 确保SMTP配置已初始化
      await smtp.initializeSmtpConfig()

      const htmlContent = smtp.generateEmailTemplate(
        '重置密码',
        `<p>您好，您请求了重置密码。</p><p>请点击下方按钮重置密码（链接在15分钟内有效）。</p><p style="color:#888">如果您没有请求重置密码，请忽略此邮件。</p>`,
        resetLink,
        clientIP
      )

      // 异步发送邮件，不阻塞响应
      event.waitUntil(
        smtp.sendMail(user.email, '重置密码 | VoiceHub', htmlContent, undefined, clientIP)
          .catch(err => console.error('发送重置密码邮件失败:', err))
      )
    }

    return { 
      success: true, 
      message: '如果账号名和邮箱匹配，重置密码链接已发送至您的邮箱。请查收并按照邮件中的说明重置密码。' 
    }
  } catch (error: any) {
    console.error('重置密码请求失败:', error)
    throw createError({
      statusCode: 500,
      message: '系统错误，请稍后重试'
    })
  }
})
