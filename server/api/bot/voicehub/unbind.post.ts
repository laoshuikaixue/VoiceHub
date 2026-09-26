import { defineEventHandler, getHeader, readBody } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, astrbotBindings, systemSettings, users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { ASTRBOT_TOKEN_HEADER, equalAstrbotToken } from '~~/server/utils/astrbot-notification'

export default defineEventHandler(async (event) => {
  const [settings] = await db.select({ token: systemSettings.astrbotToken, enabled: systemSettings.astrbotEnabled })
    .from(systemSettings).limit(1)
  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }
  const body = await readBody(event)
  const umo = body?.umo
  if (typeof umo !== 'string' || !umo || umo.length > 512) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '会话 ID 无效')
  }
  const [candidate] = await db.select({ id: astrbotBindings.userId, platform: astrbotBindings.platform })
    .from(astrbotBindings).where(eq(astrbotBindings.umo, umo)).limit(1)
  if (!candidate) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_UNBIND_FAILED, '此会话尚未绑定')
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ id: users.id })
      .from(users).where(eq(users.id, candidate.id)).for('update')
    if (!account) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_UNBIND_FAILED, '此会话尚未绑定')
    const [removed] = await tx.delete(astrbotBindings).where(eq(astrbotBindings.umo, umo)).returning()
    if (!removed) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_UNBIND_FAILED, '此会话尚未绑定')
    // 解绑只清该平台未消费的码；已消费的保留，便于审计与幂等（与用户侧解绑一致）。
    await tx.delete(astrbotBindingCodes).where(and(eq(astrbotBindingCodes.userId, candidate.id),
      eq(astrbotBindingCodes.platform, candidate.platform), isNull(astrbotBindingCodes.consumedAt)))
    return { success: true }
  })
})
