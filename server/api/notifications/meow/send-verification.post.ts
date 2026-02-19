import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { nickname, verificationCode } = body

    if (!nickname || !verificationCode) {
      throw createError({
        statusCode: 400,
        statusMessage: '昵称和验证码不能为空'
      })
    }

    // 验证昵称格式
    if (nickname.includes('/')) {
      throw createError({
        statusCode: 400,
        statusMessage: '昵称不能包含斜杠'
      })
    }

    // 发送验证码到 MeoW
    const message = `VoiceHub 账号绑定验证码：${verificationCode}`
    const title = 'VoiceHub 账号绑定'

    // 使用 GET 请求发送验证码
    const meowUrl = `https://api.chuckfang.com/${encodeURIComponent(nickname)}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`

    const response = await fetch(meowUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VoiceHub/1.0'
      }
    })

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: '发送验证码失败，请检查昵称是否正确'
      })
    }

    const result = await response.json()

    if (result.status !== 200) {
      throw createError({
        statusCode: 500,
        statusMessage: result.message || '发送验证码失败'
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
      statusMessage: '发送验证码失败，请稍后重试'
    })
  }
})
