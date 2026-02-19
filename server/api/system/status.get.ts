import { defineEventHandler } from 'h3'
import { databaseManager } from '~~/server/utils/database-manager'

export default defineEventHandler(async (event) => {
  try {
    // 获取数据库连接状态
    const dbStatus = await databaseManager.getConnectionStatus()
    const poolStatus = await databaseManager.getConnectionPoolStatus()

    // 数据库连接测试结果
    const dbTestResult = dbStatus.connected
    const dbError = dbStatus.connected ? null : dbStatus.error

    // 获取系统信息
    const systemInfo = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    }

    // 返回完整的系统状态
    return {
      status: 'ok',
      database: {
        connected: dbTestResult,
        poolStatus: poolStatus,
        connectionInfo: dbStatus,
        error: dbError
      },
      system: systemInfo
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      database: {
        connected: false,
        poolStatus: null,
        error: error.message
      }
    }
  }
})
