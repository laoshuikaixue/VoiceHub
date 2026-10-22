import { databaseManager } from '~~/server/utils/database-manager'
import { canReadSystemSettings } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 验证管理员权限（守卫在 try 外：401/403 原样抛出，不被 catch 改写）
  await canReadSystemSettings(event)

  try {
    // 使用改进的数据库管理器获取性能指标
    const performanceMetrics = await databaseManager.getPerformanceMetrics()

    return {
      ...performanceMetrics,
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    if (error.statusCode === 401) {
      throw error
    }

    console.error('Database performance API error:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error'
    })
  }
})