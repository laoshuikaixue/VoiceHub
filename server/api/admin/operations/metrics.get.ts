import { defineEventHandler, createError } from 'h3'
import { verifyAdminAuth } from '~~/server/utils/auth'
import { getOperationsMetrics } from '~~/server/utils/operations-metrics'
import { getRedisStats } from '~~/server/utils/redis'
import { databaseManager } from '~~/server/utils/database-manager'
import { getMusicSseStats } from '~~/server/api/music/websocket'
import { getProgressSseStats } from '~~/server/api/progress/events'

export default defineEventHandler(async (event) => {
  const authResult = await verifyAdminAuth(event)
  if (!authResult.success) {
    throw createError({ statusCode: 401, message: authResult.message })
  }

  const [pool, database] = await Promise.allSettled([
    databaseManager.getConnectionPoolStatus(),
    databaseManager.getPerformanceMetrics()
  ])

  return {
    success: true,
    data: {
      metrics: getOperationsMetrics(),
      redis: getRedisStats(),
      sse: {
        music: getMusicSseStats(),
        progress: getProgressSseStats()
      },
      database: {
        pool: pool.status === 'fulfilled' ? pool.value : null,
        performance: database.status === 'fulfilled' ? database.value : null
      }
    }
  }
})
