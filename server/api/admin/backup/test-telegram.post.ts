import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '只有超级管理员可以测试 Telegram 发送' })
  }

  const body = await readBody(event)
  const { botToken, chatId } = body

  if (!botToken || !chatId) {
    throw createError({ statusCode: 400, message: '缺少必要参数：botToken, chatId' })
  }

  try {
    // 先发送一条文本消息确认连接
    const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'VoiceHub Telegram Bot 连接测试成功！'
      })
    })

    const result = await textRes.json() as any
    if (!result.ok) {
      throw new Error(result.description || 'Telegram API 返回错误')
    }

    return { success: true, message: 'Telegram Bot 连接测试成功' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Telegram Bot 连接测试失败' }
  }
})