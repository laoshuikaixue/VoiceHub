import { verifyAdminAuth } from '~~/server/utils/auth'
import { databaseManager } from '~~/server/utils/database-manager'

export default defineEventHandler(async (event) => {
  try {
    const authResult = await verifyAdminAuth(event)

    if (!authResult.success) {
      throw createError({
        statusCode: 401,
        message: authResult.message
      })
    }

    const cleanedCount = await databaseManager.cleanupExpiredSessions()

    databaseManager.clearHealthCheckCache()

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
