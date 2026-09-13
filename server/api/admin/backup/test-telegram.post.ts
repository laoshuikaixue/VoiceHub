import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  let { botToken, chatId } = body

  // botToken 为空时从已保存配置中获取
  if (!botToken) {
    const config = await getAutoBackupConfig()
    botToken = config?.methods?.telegram?.botToken || ''
    chatId = chatId || config?.methods?.telegram?.chatId || ''
  }

  if (!botToken || !chatId) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少必要参数：botToken, chatId')
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