import { databaseManager } from '~~/server/utils/database-manager'

export default defineEventHandler(async () => {
  try {
    // 使用改进的数据库管理器获取连接池状态
    const poolStatus = await databaseManager.getConnectionPoolStatus()

    return {
      ...poolStatus,
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    if (error.statusCode === 401) {
      throw error
    }

    console.error('Database pool status API error:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error'
    })
  }
})