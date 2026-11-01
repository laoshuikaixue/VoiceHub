import { databaseManager } from '~~/server/utils/database-manager'

export default defineEventHandler(async () => {
  try {
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
