import { defineEventHandler } from 'h3'
import { dbPool } from '~/server/utils/db-pool'

export default defineEventHandler(async (event) => {
  try {
    console.log('[Reconnect API] 收到强制重连请求')
    
    // 强制重连数据库
    const success = await dbPool.forceReconnect()
    
    if (success) {
      console.log('[Reconnect API] 重连成功')
      return {
        success: true,
        message: '数据库重连成功',
        status: dbPool.getStatus(),
        timestamp: new Date().toISOString()
      }
    } else {
      console.log('[Reconnect API] 重连失败')
      return {
        success: false,
        message: '数据库重连失败',
        status: dbPool.getStatus(),
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('[Reconnect API] 重连过程中出错:', error)
    return {
      success: false,
      message: '重连过程中出错: ' + error.message,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
})
