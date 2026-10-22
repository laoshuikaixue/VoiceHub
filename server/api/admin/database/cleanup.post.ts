import { databaseManager } from '~~/server/utils/database-manager'
import { canResetDatabase } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 数据库写操作仅限超级管理员（routePermissionMap 登记 database.reset；守卫在 try 外）
  await canResetDatabase(event)

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
