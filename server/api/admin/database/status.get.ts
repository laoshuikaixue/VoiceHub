import { databaseManager } from '~~/server/utils/database-manager'
import { canReadSystemSettings } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 验证管理员权限（守卫在 try 外：401/403 原样抛出，不被 catch 改写）
  await canReadSystemSettings(event)

  try {
    // 使用改进的数据库管理器获取状态
    const healthCheck = await databaseManager.healthCheck()

    // 根据延迟确定状态
    let status = 'error'
    let message = 'Database connection failed'

    if (healthCheck.status) {
      if (healthCheck.latency < 100) {
        status = 'healthy'
        message = 'Database connection is healthy'
      } else if (healthCheck.latency < 500) {
        status = 'slow'
        message = 'Database connection is slow'
      } else {
        status = 'error'
        message = 'Database connection timeout'
      }
    } else {
      message = healthCheck.error || 'Database connection failed'
    }

    return {
      success: healthCheck.status,
      status: status,
      message: message,
      responseTime: healthCheck.latency,
      timestamp: healthCheck.timestamp.toISOString(),
      error: healthCheck.error
    }
  } catch (error: any) {
    if (error.statusCode === 401) {
      throw error
    }

    console.error('Database status API error:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error'
    })
  }
})