import { defineEventHandler } from 'h3'
import { getServerDate } from '~~/server/utils/serverTime'
import { databaseManager } from '~~/server/utils/database-manager'

export default defineEventHandler(async () => {
  try {
    console.log('[Reconnect API] 收到强制重连请求')

    // 测试数据库连接
    const connectionStatus = await databaseManager.getConnectionStatus()
    const poolStatus = await databaseManager.getConnectionPoolStatus()

    if (connectionStatus.connected) {
      console.log('[Reconnect API] 数据库连接正常')
      return {
        success: true,
        message: '数据库连接正常',
        connectionStatus,
        poolStatus,
        timestamp: getServerDate().toISOString()
      }
    } else {
      console.log('[Reconnect API] 数据库连接异常')
      return {
        success: false,
        message: '数据库连接异常',
        connectionStatus,
        poolStatus,
        timestamp: getServerDate().toISOString()
      }
    }
  } catch (error) {
    console.error('[Reconnect API] 重连过程中出错:', error)
    return {
      success: false,
      message: '重连过程中出错: ' + error.message,
      error: error.message,
      timestamp: getServerDate().toISOString()
    }
  }
})
