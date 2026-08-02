import { defineEventHandler, createError } from 'h3'
import { verifyAdminAuth } from '~~/server/utils/auth'
import { getOperationsMetrics } from '~~/server/utils/operations-metrics'
import { getRedisStats } from '~~/server/utils/redis'
import { databaseManager } from '~~/server/utils/database-manager'
import { getMusicSseStats } from '~~/server/api/music/websocket'
import { getProgressSseStats } from '~~/server/api/progress/events'

let sentryCache: { expiresAt: number; value: any } | null = null

const getSentryIssues = async () => {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim()
  const organization = process.env.SENTRY_ORG?.trim()
  const project = process.env.SENTRY_PROJECT?.trim()
  if (!token || !organization || !project) {
    return { configured: false, issues: [] }
  }

  if (sentryCache && sentryCache.expiresAt > Date.now()) return sentryCache.value

  try {
    const baseUrl = (process.env.SENTRY_API_URL || 'https://sentry.io/api/0').replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/issues/?query=is%3Aunresolved&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) throw new Error(`Sentry API ${response.status}`)
    const issues = await response.json() as Array<any>
    const value = {
      configured: true,
      available: true,
      issues: issues.map((issue) => ({ id: issue.id, title: issue.title, level: issue.level, count: issue.count, lastSeen: issue.lastSeen }))
    }
    sentryCache = { value, expiresAt: Date.now() + 30_000 }
    return value
  } catch (error) {
    const value = { configured: true, available: false, error: error instanceof Error ? error.message : 'Sentry 查询失败', issues: [] }
    sentryCache = { value, expiresAt: Date.now() + 30_000 }
    return value
  }
}

export default defineEventHandler(async (event) => {
  const authResult = await verifyAdminAuth(event)
  if (!authResult.success) {
    throw createError({ statusCode: 401, message: authResult.message })
  }

  const [pool, database, diagnostics, businessQueue, apiKeyUsage, persistedRequests, timeline, sentry] = await Promise.allSettled([
    databaseManager.getConnectionPoolStatus(),
    databaseManager.getPerformanceMetrics(),
    databaseManager.getDiagnostics(),
    databaseManager.getBusinessQueueStats(),
    databaseManager.getApiKeyUsageStats(),
    databaseManager.getPersistedRequestSamples(),
    databaseManager.getOperationsMetricTimeline(),
    getSentryIssues()
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
        performance: database.status === 'fulfilled' ? database.value : null,
        diagnostics: diagnostics.status === 'fulfilled' ? diagnostics.value : null,
        businessQueue: businessQueue.status === 'fulfilled' ? businessQueue.value : null,
        apiKeyUsage: apiKeyUsage.status === 'fulfilled' ? apiKeyUsage.value : null,
        persistedRequests: persistedRequests.status === 'fulfilled' ? persistedRequests.value : null,
        timeline: timeline.status === 'fulfilled' ? timeline.value : null
      },
      sentry: sentry.status === 'fulfilled' ? sentry.value : { configured: false, issues: [] }
    }
  }
})
