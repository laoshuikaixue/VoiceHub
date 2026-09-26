import { defineEventHandler, readBody } from 'h3'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { postAstrbotNotification } from '~~/server/services/astrbotNotificationService'
import { enqueueAstrbotNotifications } from '~~/server/services/astrbotOutboxService'
import { db } from '~/drizzle/db'
import { astrbotBindings } from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { isAstrbotPlatformEnabled, parseAstrbotPlatform } from '~~/server/utils/astrbot-platforms'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  const platform = parseAstrbotPlatform((await readBody(event))?.platform)
  if (!platform) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '平台无效')
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled || !isAstrbotPlatformEnabled(settings.astrbotPlatforms, platform)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
  }
  const [target] = await db.select({ umo: astrbotBindings.umo }).from(astrbotBindings)
    .where(and(eq(astrbotBindings.userId, user.id), eq(astrbotBindings.platform, platform))).limit(1)
  if (!target?.umo) throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '请先绑定机器人会话')
  if (settings.astrbotPushMode === 'pull') {
    const queued = await enqueueAstrbotNotifications([user.id], 'VoiceHub 测试通知', '机器人测试消息。', platform)
    if (!queued) throw createApiError(502, SERVER_ERROR_CODES.ASTRBOT_TEST_FAILED, '机器人测试消息未入队')
    return { success: true, queued: true }
  }
  try {
    const result = await postAstrbotNotification([target.umo], 'VoiceHub 测试通知', '机器人测试消息。')
    if (result.sent !== 1) throw new Error('目标会话发送失败')
    return { success: true }
  } catch (error) {
    console.warn('[AstrBot] 用户测试推送失败:', error)
    throw createApiError(502, SERVER_ERROR_CODES.ASTRBOT_TEST_FAILED, '机器人测试推送失败')
  }
})
