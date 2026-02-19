import { verifyAdminAuth } from '~~/server/utils/auth'
import { databaseManager } from '~~/server/utils/database-manager'

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    await verifyAdminAuth(event)

    // 清理过期会话
    const cleanedCount = await databaseManager.cleanupExpiredSessions()

    // 清除健康检查缓存以确保下次检查获取最新状态
    databaseManager.clearHealthCheckCache()

    return {
      success: true,
      message: `Successfully cleaned up ${cleanedCount} expired sessions`,
      cleanedCount,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('认证')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Cleanup failed'
    })
  }
})
