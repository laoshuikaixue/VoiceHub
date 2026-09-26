import { defineEventHandler, getHeader, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { ASTRBOT_TOKEN_HEADER, equalAstrbotToken } from '~~/server/utils/astrbot-notification'
import { parseAstrbotAckResults } from '~~/server/utils/astrbot-pull'
import { completeAstrbotOutbox, failAstrbotOutbox } from '~~/server/services/astrbotOutboxService'

/**
 * 投递回执（拉取模式）。
 *
 * 插件完成一次投递后按条回报结果：成功标记已投递，失败则释放租约等待重试
 * （超过尝试上限后停止重试）。回执直接决定条目终态，形状非法时整体拒绝。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({ token: systemSettings.astrbotToken, enabled: systemSettings.astrbotEnabled })
    .from(systemSettings).limit(1)
  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const results = parseAstrbotAckResults(await readBody(event))
  if (!results) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '回执格式无效')
  }

  let updated = 0
  for (const item of results) {
    if (item.success) {
      if (await completeAstrbotOutbox(item.id, item.claimToken)) updated++
    } else {
      if (await failAstrbotOutbox(item.id, item.claimToken, item.reason, item.failedUmos)) updated++
    }
  }
  return { success: true, updated }
})
