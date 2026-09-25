import { defineEventHandler } from 'h3'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { postAstrbotNotification } from '~~/server/services/astrbotNotificationService'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
  }
  const [target] = await db.select({ umo: users.astrbotUmo }).from(users)
    .where(eq(users.id, user.id)).limit(1)
  if (!target?.umo) throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '请先绑定机器人会话')
  try {
    const result = await postAstrbotNotification([target.umo], 'VoiceHub 测试通知', '机器人推送已成功连接。')
    if (result.sent !== 1) throw new Error('目标会话发送失败')
    return { success: true }
  } catch (error) {
    console.warn('[AstrBot] 用户测试推送失败:', error)
    throw createApiError(502, SERVER_ERROR_CODES.ASTRBOT_TEST_FAILED, '机器人测试推送失败')
  }
})
