import { defineEventHandler } from 'h3'
import { databaseManager } from '~~/server/utils/database-manager'
import { getInstanceId } from '~~/server/utils/instance-id'
import { isTelemetryEnabled } from '~~/server/utils/telemetry'

export default defineEventHandler(async () => {
  try {
    const instanceId = await getInstanceId()
    const telemetryEnabled = await isTelemetryEnabled()

    // 获取数据库连接状态
    const dbStatus = await databaseManager.getConnectionStatus()
    let poolStatus = null
    try {
      poolStatus = await databaseManager.getConnectionPoolStatus()
    } catch (poolError) {
      console.warn('[System Status] Failed to get database pool status:', poolError)
    }

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
      instance: {
        instanceId,
        telemetryEnabled
      },
      database: {
        connected: dbTestResult,
        poolStatus: poolStatus,
        connectionInfo: dbStatus,
        error: dbError
      },
      system: systemInfo
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      status: 'error',
      error: errorMessage,
      database: {
        connected: false,
        poolStatus: null,
        error: errorMessage
      }
    }
  }
})
