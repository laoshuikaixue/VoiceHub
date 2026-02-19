import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 使用认证中间件提供的用户信息
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }

    const userId = user.id

    // 获取用户的 MeoW 绑定信息
    const userDataResult = await db
      .select({
        id: users.id,
        username: users.username,
        meowNickname: users.meowNickname
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const userData = userDataResult[0]

    if (!userData) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    if (!userData.meowNickname) {
      throw createError({
        statusCode: 400,
        statusMessage: '尚未绑定 MeoW 账号'
      })
    }

    // 发送测试通知
    const message = `这是来自 VoiceHub 的测试通知！您的账号 ${userData.username} 已成功绑定 MeoW。`
    const title = 'VoiceHub 测试通知'

    const meowUrl = `https://api.chuckfang.com/${encodeURIComponent(userData.meowNickname)}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`

    const response = await fetch(meowUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VoiceHub/1.0'
      }
    })

    if (!response.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: '发送测试通知失败'
      })
    }

    const result = await response.json()

    if (result.status !== 200) {
      throw createError({
        statusCode: 500,
        statusMessage: result.message || '发送测试通知失败'
      })
    }

    return {
      success: true,
      message: '测试通知发送成功'
    }
  } catch (error) {
    console.error('发送 MeoW 测试通知失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '发送测试通知失败，请稍后重试'
    })
  }
})
