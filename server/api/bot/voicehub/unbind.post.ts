import { defineEventHandler, getHeader, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { systemSettings, users } from '~/drizzle/schema'
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
  const [updated] = await db.update(users)
    .set({ astrbotUmo: null, astrbotPlatform: null, astrbotBoundAt: null })
    .where(eq(users.astrbotUmo, umo))
    .returning({ id: users.id })
  if (!updated) throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_UNBIND_FAILED, '此会话尚未绑定')
  return { success: true }
})
