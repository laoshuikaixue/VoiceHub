import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings } from '~/drizzle/schema'
import { formatDateTime } from '~/utils/timeUtils'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  describeAstrbotBindChat,
  invalidAstrbotBindTicket,
  isSameAstrbotBinding,
  loadAstrbotBindSettings,
  loadAstrbotBindTicket,
  loadOwnAstrbotBinding
} from '~~/server/utils/astrbot-bind-ticket'
import { hashAstrbotBindTicket, makeAstrbotBindConfirmation } from '~~/server/utils/astrbot-notification'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const user = event.context.user
  if (!user?.sessionId) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')

  const token = getQuery(event).token
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) throw invalidAstrbotBindTicket()

  const [settings] = await loadAstrbotBindSettings(db)
  if (!settings?.enabled || !settings.token) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '机器人推送未启用')
  }
  const hash = hashAstrbotBindTicket(token, settings.token)
  const [row] = await loadAstrbotBindTicket(db, hash)
  if (!row || (row.consumedAt && row.consumedByUserId !== user.id)) throw invalidAstrbotBindTicket()
  if (adapterToAstrbotPlatform(row.adapter) !== row.platform ||
    !isAstrbotPlatformEnabled(settings.platforms, row.platform)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_NOT_CONFIGURED, '该机器人平台未启用')
  }

  const [current] = await loadOwnAstrbotBinding(db, user.id, row.platform)
  const sameBinding = isSameAstrbotBinding(current, row)
  if (row.consumedAt && !sameBinding) throw invalidAstrbotBindTicket()

  const [owner] = await db.select({ id: astrbotBindings.userId }).from(astrbotBindings)
    .where(eq(astrbotBindings.umo, row.umo)).limit(1)
  const conflict = owner && owner.id !== user.id ? 'chat' : current && !sameBinding ? 'account' : null
  const confirmedByMe = sameBinding
  return {
    success: true,
    account: { username: user.username, name: user.name },
    platform: row.platform,
    target: describeAstrbotBindChat(row),
    current: current ? { ...describeAstrbotBindChat(current), boundAt: formatDateTime(current.boundAt) } : null,
    conflict,
    confirmedByMe,
    confirmation: conflict || confirmedByMe ? null : makeAstrbotBindConfirmation(
      hash, settings.token, user.id, user.sessionId, user.tokenVersion
    ),
    expiresAt: row.expiresAt.toISOString(),
    expiresAtDisplay: formatDateTime(row.expiresAt)
  }
})
