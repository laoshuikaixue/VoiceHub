// 记录已登录用户的条款同意：仅当提交的版本与当前内容指纹一致时落库，杜绝被动/旧版本记录
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { computeLegalConsentVersion } from '~~/server/utils/legal-consent'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_LOGIN_REQUIRED, '请先登录')
  const body = await readBody(event).catch(() => ({}))
  const settings = await db.query.systemSettings.findFirst({
    columns: { legalConsentEnabled: true, legalConsentUpdatedDate: true, legalConsentDocuments: true }
  })
  const currentVersion = computeLegalConsentVersion(settings ?? null)
  if (!currentVersion) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '当前未启用条款确认')
  // 只记录用户显式同意且与当前内容版本一致的记录，版本不符说明条款已更新，需重新同意
  if (typeof body?.version !== 'string' || body.version !== currentVersion) {
    throw createApiError(409, SERVER_ERROR_CODES.AUTH_LEGAL_CONSENT_REQUIRED, '条款已更新，请重新阅读并同意')
  }
  await db.update(users).set({ legalConsentVersion: currentVersion, legalConsentAt: getServerTimestamp() }).where(eq(users.id, user.id))
  return { success: true, version: currentVersion }
})
