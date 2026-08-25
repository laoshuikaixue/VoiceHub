import { defineEventHandler, getQuery } from 'h3'
import { and, authSessions, db, desc, eq } from '~/drizzle/db'
import { isNull } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { isAuthSessionStorageError } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, 'AUTH_SESSION_EXPIRED', '请先登录')

  const currentSessionId = event.context.authSessionId || String(getQuery(event).current || '')
  const now = getServerDate()
  let sessions: Array<typeof authSessions.$inferSelect>
  try {
    sessions = await db.query.authSessions.findMany({
      where: and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)),
      orderBy: desc(authSessions.lastActiveAt)
    })
  } catch (error) {
    if (!isAuthSessionStorageError(error)) throw error
    throw createApiError(
      503,
      SERVER_ERROR_CODES.AUTH_DATABASE_UNAVAILABLE,
      '登录会话存储暂时不可用，请稍后重试'
    )
  }

  return {
    success: true,
    data: sessions
      .filter((session) => session.expiresAt > now)
      .map((session) => ({
        id: session.id,
        current: session.id === currentSessionId,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        browser: session.browser,
        operatingSystem: session.operatingSystem,
        device: session.device,
        loginMethod: session.loginMethod
      }))
  }
})
