// 撤回登录条款同意：清空用户同意状态并撤销全部会话（含当前），使所有设备立即失效
import { and, authSessions, db, eq } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { isNull } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { isAuthSessionStorageError } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_LOGIN_REQUIRED, '请先登录')

  try {
    // 同意状态与会话撤销在同一事务内完成，避免清空后仍残留可用会话
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ legalConsentVersion: null, legalConsentAt: null })
        .where(eq(users.id, user.id))

      await tx
        .update(authSessions)
        .set({ revokedAt: getServerDate(), revokedReason: 'legal_consent_revoked' })
        .where(and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)))
    })
  } catch (error) {
    if (!isAuthSessionStorageError(error)) throw error
    throw createApiError(503, SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE, '登录会话存储暂时不可用，请稍后重试')
  }

  return { success: true }
})
