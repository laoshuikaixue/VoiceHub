import { defineEventHandler, getHeader, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { astrbotBindTickets, systemSettings } from '~/drizzle/schema'
import {
  adapterToAstrbotPlatform,
  isAstrbotPlatformEnabled
} from '~~/server/utils/astrbot-platforms'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { getRequestOrigin } from '~~/server/utils/request-utils'
import {
  ASTRBOT_BIND_TICKET_TTL_SECONDS,
  ASTRBOT_TOKEN_HEADER,
  createAstrbotBindTicket,
  equalAstrbotToken,
  hashAstrbotBindTicket,
  parseAstrbotPrivateUmo
} from '~~/server/utils/astrbot-notification'

/**
 * 机器人在会话内发起绑定：返回一次性确认链接，由用户在浏览器登录后确认。
 *
 * 链接本身只证明「持有该会话」（票据随消息送达该私聊），账号归属由点击链接
 * 的登录会话决定。票据只存摘要，确认前不做任何写入绑定表的操作。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled,
      platforms: systemSettings.astrbotPlatforms
    })
    .from(systemSettings)
    .limit(1)
  if (
    !settings?.enabled ||
    !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')
  ) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const body = await readBody(event)
  const target = parseAstrbotPrivateUmo(body?.umo, body?.platform)
  if (!target) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_CODE_INVALID, '私聊会话无效')
  }
  const platform = adapterToAstrbotPlatform(target.platform)
  if (!platform || !isAstrbotPlatformEnabled(settings.platforms, platform)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '该机器人平台未启用')
  }

  const ticket = createAstrbotBindTicket()
  const expiresAt = new Date(getServerDate().getTime() + ASTRBOT_BIND_TICKET_TTL_SECONDS * 1000)
  await db.insert(astrbotBindTickets).values({
    tokenHash: hashAstrbotBindTicket(ticket),
    platform,
    adapter: target.platform,
    umo: target.umo,
    expiresAt
  })

  return {
    success: true,
    url: `${getRequestOrigin(event)}/bind/${ticket}`,
    expiresIn: ASTRBOT_BIND_TICKET_TTL_SECONDS
  }
})
