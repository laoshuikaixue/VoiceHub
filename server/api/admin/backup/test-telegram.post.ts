import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'
import { ADMIN_AUDIT_RESULT, recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
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

    await recordAdminAudit(event, 'backup.test-telegram', {
      targetType: 'backup',
      summary: { chatId }
    })

    return { success: true, message: 'Telegram Bot 连接测试成功' }
  } catch (err: any) {
    // botToken 出现在请求 URL 中，摘要与错误信息一律剔除它
    const safeError = (err?.message || '').split(botToken).join('[已脱敏]')
    await recordAdminAudit(event, 'backup.test-telegram', {
      targetType: 'backup',
      summary: { chatId, error: safeError || 'Telegram Bot 连接测试失败' },
      result: ADMIN_AUDIT_RESULT.FAILURE
    })
    return { success: false, message: err.message || 'Telegram Bot 连接测试失败' }
  }
})