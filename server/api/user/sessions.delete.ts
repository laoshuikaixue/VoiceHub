import { defineEventHandler, getQuery } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  isAuthSessionStorageError,
  revokeAuthSession,
  revokeOtherAuthSessions
} from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, 'AUTH_SESSION_EXPIRED', '请先登录')

  const query = getQuery(event)
  const sessionId = typeof query.id === 'string' ? query.id : ''
  try {
    if (sessionId) {
      const revoked = await revokeAuthSession(user.id, sessionId, 'logout_single')
      if (!revoked) throw createApiError(400, 'COMMON_INVALID_PARAMS', '登录会话不存在或已失效')
      return { success: true }
    }

    await revokeOtherAuthSessions(user.id, event.context.authSessionId || null)
  } catch (error) {
    if (!isAuthSessionStorageError(error)) throw error
    throw createApiError(
      503,
      SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE,
      '登录会话存储暂时不可用，请稍后重试'
    )
  }
  return { success: true }
})
