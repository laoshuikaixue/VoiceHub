import { defineEventHandler } from 'h3'
import { getPoolStatus } from '~/server/utils/db-pool'
import { prisma } from '~/prisma/client'

export default defineEventHandler(async (event) => {
  try {
    // 获取数据库连接池状态
    const poolStatus = getPoolStatus()

    // 尝试执行一个简单的数据库查询来测试连接
    let dbTestResult = false
    let dbError = null

    try {
      await prisma.$queryRaw`SELECT 1 as test`
      dbTestResult = true
    } catch (error) {
      dbError = error.message
    }
    
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
        poolStatus: getPoolStatus(),
        error: error.message
      }
    }
  }
})
