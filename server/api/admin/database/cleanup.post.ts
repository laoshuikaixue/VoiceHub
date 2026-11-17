import { databaseManager } from '~~/server/utils/database-manager'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  try {
    const cleanedCount = await databaseManager.cleanupExpiredSessions()

    databaseManager.clearHealthCheckCache()

    await recordAdminAudit(event, 'database.cleanup', {
      targetType: 'session',
      targetId: `batch:${cleanedCount}`,
      summary: { cleanedCount }
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

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Cleanup failed'
    })
  }
})
