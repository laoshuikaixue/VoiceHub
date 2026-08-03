import { verifyAdminAuth } from '~~/server/utils/auth'
import { databaseManager } from '~~/server/utils/database-manager'
import { assertAdminOperationTablesProtected, getAdminOperationFailureCode, recordAdminOperation, shouldRecordAdminOperationFailure } from '~~/server/services/adminOperationLogService'

export default defineEventHandler(async (event) => {
  try {
    const authResult = await verifyAdminAuth(event)

    if (!authResult.success) {
      throw createError({
        statusCode: 401,
        message: authResult.message
      })
    }

    assertAdminOperationTablesProtected(['database_sessions'])
    const cleanedCount = await databaseManager.cleanupExpiredSessions()

    databaseManager.clearHealthCheckCache()

    await recordAdminOperation(event, {
      actor: { id: authResult.user.id, role: authResult.user.role },
      action: 'DB.CLEANUP',
      targetType: 'DATABASE',
      targetId: 'expired-sessions',
      result: 'SUCCESS',
      summary: '管理员清理了过期数据库会话',
      changes: { count: cleanedCount }
    })

    return {
      success: true,
      message: `Successfully cleaned up ${cleanedCount} expired sessions`,
      cleanedCount,
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    if (error.statusCode === 401) {
      throw error
    }

    if (shouldRecordAdminOperationFailure(error)) {
      await recordAdminOperation(event, {
        actor: event.context.user,
        action: 'DB.CLEANUP',
        targetType: 'DATABASE',
        targetId: 'expired-sessions',
        result: 'FAILURE',
        summary: '管理员清理过期数据库会话失败',
        failureCode: getAdminOperationFailureCode(error, 'DB_CLEANUP_FAILED')
      })
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Cleanup failed'
    })
  }
})
