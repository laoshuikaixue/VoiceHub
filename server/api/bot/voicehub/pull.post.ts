import { defineEventHandler, getHeader } from 'h3'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { ASTRBOT_TOKEN_HEADER, equalAstrbotToken } from '~~/server/utils/astrbot-notification'
import { toAstrbotPullItem } from '~~/server/utils/astrbot-pull'
import { claimAstrbotOutbox } from '~~/server/services/astrbotOutboxService'

/**
 * 领取待投递通知（拉取模式）。
 *
 * 供无法被 VoiceHub 访问的插件主动取件：插件部署在内网/NAT 后时，
 * push 模式无法投递，改由插件按固定间隔轮询本端点拉取并回执。
 * 领取会加租约，避免同一批被并发投递；租约过期后条目可被重新领取。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({ token: systemSettings.astrbotToken, enabled: systemSettings.astrbotEnabled })
    .from(systemSettings).limit(1)
  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }
  const rows = await claimAstrbotOutbox()
  return { success: true, items: rows.map(toAstrbotPullItem) }
})
