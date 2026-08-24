import { defineEventHandler, getQuery } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
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
  }
  return { success: true }
})
