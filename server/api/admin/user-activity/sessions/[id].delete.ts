import { and, eq, isNull } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { verifyUserAuth } from '~~/server/utils/auth'
import { db } from '~/drizzle/db'
import { userSessions } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { markUserSessionRevoked } from '~~/server/services/userSessionService'
import { recordAdminOperation } from '~~/server/services/adminOperationLogService'

export default defineEventHandler(async (event) => {
  const auth = await verifyUserAuth(event)
  if (!auth.success || !auth.user) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未登录或登录已失效')
  if (auth.user.role !== 'SUPER_ADMIN') throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '仅超级管理员可处置用户会话')

  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '会话 ID 不能为空')

  try {
    const result = await db.update(userSessions)
      .set({ revokedAt: getServerDate(), revokedBy: auth.user.id, revocationReason: '管理员强制下线' })
      .where(and(eq(userSessions.id, id), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id, userId: userSessions.userId })

    if (!result[0]) throw createApiError(404, SERVER_ERROR_CODES.USER_SESSION_NOT_FOUND, '会话不存在或已下线')
    markUserSessionRevoked(id)
    await recordAdminOperation(event, {
      actor: auth.user,
      action: 'SESSION.REVOKE',
      targetType: 'USER_SESSION',
      targetId: id,
      targetLabel: `用户会话 ${result[0].userId}`,
      result: 'SUCCESS',
      summary: '管理员强制下线用户会话',
      changes: { reason: '管理员强制下线' }
    })
    return { success: true }
  } catch (error: any) {
    if (Number(error?.statusCode) === 404) throw error
    await recordAdminOperation(event, {
      actor: auth.user,
      action: 'SESSION.REVOKE',
      targetType: 'USER_SESSION',
      targetId: id,
      result: 'FAILURE',
      summary: '管理员强制下线用户会话失败',
      failureCode: 'SESSION_REVOKE_FAILED',
      changes: { reason: '会话处置失败' }
    })
    throw createApiError(500, SERVER_ERROR_CODES.USER_SESSION_REVOKE_FAILED, '强制下线失败')
  }
})
