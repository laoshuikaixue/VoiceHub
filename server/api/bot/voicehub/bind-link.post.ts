import { defineEventHandler, getHeader, readBody, setResponseHeader } from 'h3'
import { lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindTickets } from '~/drizzle/schema'
import {
  adapterToAstrbotPlatform,
  isAstrbotPlatformEnabled
} from '~~/server/utils/astrbot-platforms'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { loadAstrbotBindSettings } from '~~/server/utils/astrbot-bind-ticket'
import {
  ASTRBOT_BIND_TICKET_TTL_SECONDS,
  ASTRBOT_TOKEN_HEADER,
  createAstrbotBindTicket,
  equalAstrbotToken,
  hashAstrbotBindTicket,
  normalizeAstrbotBaseUrl,
  parseAstrbotPrivateUmo
} from '~~/server/utils/astrbot-notification'

/**
 * 机器人在会话内发起绑定：返回一次性确认链接，由用户在浏览器登录后确认。
 *
 * 链接可转发，不作为账号恢复凭据。确认前不写入绑定表。
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const botToken = getHeader(event, ASTRBOT_TOKEN_HEADER)
  if (!botToken) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }
  const body = await readBody(event)

  return db.transaction(async (tx) => {
    const [settings] = await loadAstrbotBindSettings(tx, true)
    if (!settings?.enabled || !equalAstrbotToken(botToken, settings.token ?? '')) {
      throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
    }

    const target = parseAstrbotPrivateUmo(body?.umo, body?.platform)
    if (!target) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_CODE_INVALID, '私聊会话无效')
    }
    const platform = adapterToAstrbotPlatform(target.platform)
    if (!platform || !isAstrbotPlatformEnabled(settings.platforms, platform)) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '该机器人平台未启用')
    }

    const origin = normalizeAstrbotBaseUrl(useRuntimeConfig(event).public.host)
    if (!origin) {
      throw createApiError(503, SERVER_ERROR_CODES.ASTRBOT_BIND_ORIGIN_REQUIRED, '请配置站点外部地址')
    }

    const ticket = createAstrbotBindTicket()
    const now = getServerDate()
    const expiresAt = getServerDate()
    expiresAt.setTime(now.getTime() + ASTRBOT_BIND_TICKET_TTL_SECONDS * 1000)
    await tx.delete(astrbotBindTickets).where(lte(astrbotBindTickets.expiresAt, now))
    await tx.insert(astrbotBindTickets).values({
      tokenHash: hashAstrbotBindTicket(ticket, botToken),
      platform,
      adapter: target.platform,
      umo: target.umo,
      expiresAt
    })

    return {
      success: true,
      url: `${origin}/bind/${ticket}`,
      expiresIn: ASTRBOT_BIND_TICKET_TTL_SECONDS
    }
  })
})
