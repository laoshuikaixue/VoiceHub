import { db } from '~/drizzle/db'
import { users, systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_LOGIN_REQUIRED, '请先登录')
  const settings = await db.query.systemSettings.findFirst({ columns: { legalConsentEnabled: true, legalConsentUpdatedDate: true } })
  if (!settings?.legalConsentEnabled || !settings.legalConsentUpdatedDate) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '当前未启用条款确认')
  await db.update(users).set({ legalConsentVersion: settings.legalConsentUpdatedDate, legalConsentAt: getServerTimestamp() }).where(eq(users.id, user.id))
  return { success: true, version: settings.legalConsentUpdatedDate }
})
