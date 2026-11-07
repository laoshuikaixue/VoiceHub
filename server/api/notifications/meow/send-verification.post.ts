import { createError, defineEventHandler, readBody } from 'h3'
import { sendMeowNotification } from '~~/server/services/meowNotificationService'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { nickname, verificationCode } = body

    if (!nickname || !verificationCode) {
      throw createError({
        statusCode: 400,
        message: '昵称和验证码不能为空'
      })
    }

    // 验证昵称格式
    if (nickname.includes('/')) {
      throw createError({
        statusCode: 400,
        message: '昵称不能包含斜杠'
      })
    }

    // 发送验证码到 MeoW
    const message = `VoiceHub 账号绑定验证码：${verificationCode}`
    const title = 'VoiceHub 账号绑定'

    const result = await sendMeowNotification(nickname, title, message)

    if (!result.ok) {
      throw createError({
        statusCode: 500,
        message: result.msg || '发送验证码失败，请检查昵称是否正确'
      })
    }

    return {
      success: true,
      message: '验证码发送成功'
    }
  } catch (error) {
    console.error('发送 MeoW 验证码失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '发送验证码失败，请稍后重试'
    })
  }
})
