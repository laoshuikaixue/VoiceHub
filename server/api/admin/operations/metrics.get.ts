import { defineEventHandler, createError, getQuery } from 'h3'
import { verifyAdminAuth } from '~~/server/utils/auth'
import { getOperationsMetrics, observeRuntimeDeployment, persistOperationsDatabaseSnapshot, triggerMusicSourceProbe } from '~~/server/utils/operations-metrics'
import { getRedisMetrics, getRedisStats } from '~~/server/utils/redis'
import { databaseManager } from '~~/server/utils/database-manager'
import { getMusicSseStats } from '~~/server/api/music/websocket'
import { getProgressSseStats } from '~~/server/api/progress/events'
import { getAutoBackupConfig, isAutoBackupEnabled } from '~~/server/services/autoBackupService'
import { logManager } from '~~/server/utils/log-manager'
import { getServerTimestamp } from '~~/server/utils/serverTime'

let sentryCache: { expiresAt: number; value: any } | null = null
let sentryRequestInFlight: Promise<any> | null = null
const SENTRY_CACHE_TTL_MS = 2 * 60 * 1000
const SENTRY_FAILURE_CACHE_TTL_MS = 15 * 1000

const maskIpAddress = (value: unknown) => {
  const ip = String(value || '')
  if (!ip) return ''
  if (ip.includes(':')) return `${ip.split(':').filter(Boolean).slice(0, 3).join(':')}::*`
  const parts = ip.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip
}

const getSentryIssues = async () => {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim()
  const organization = process.env.SENTRY_ORG?.trim()
  const project = process.env.SENTRY_PROJECT?.trim()
  if (!token || !organization || !project) {
    return { configured: false, issues: [] }
  }

  if (sentryCache && sentryCache.expiresAt > getServerTimestamp()) return sentryCache.value
  if (sentryRequestInFlight) return await sentryRequestInFlight

  sentryRequestInFlight = (async () => {
    try {
      const baseUrl = (process.env.SENTRY_API_URL || 'https://sentry.io/api/0').replace(/\/$/, '')
      const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/issues/?query=is%3Aunresolved&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000)
      })
      if (!response.ok) throw new Error(`Sentry API ${response.status}`)
      const issues = await response.json() as Array<any>
      const value = {
        configured: true,
        available: true,
        issues: issues.map((issue) => ({ id: issue.id, title: issue.title, level: issue.level, count: issue.count, lastSeen: issue.lastSeen }))
      }
      sentryCache = { value, expiresAt: getServerTimestamp() + SENTRY_CACHE_TTL_MS }
      return value
    } catch (error) {
      const value = { configured: true, available: false, error: error instanceof Error ? error.message : 'Sentry 查询失败', issues: [] }
      sentryCache = { value, expiresAt: getServerTimestamp() + SENTRY_FAILURE_CACHE_TTL_MS }
      return value
    }
  })()

  try {
    return await sentryRequestInFlight
  } finally {
    sentryRequestInFlight = null
  }
}

const getSentryTrace = async (requestId: string) => {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim()
  const organization = process.env.SENTRY_ORG?.trim()
  const project = process.env.SENTRY_PROJECT?.trim()
  if (!requestId || !token || !organization || !project) return { configured: Boolean(token && organization && project), available: false, spans: [] }
  try {
    const baseUrl = (process.env.SENTRY_API_URL || 'https://sentry.io/api/0').replace(/\/$/, '')
    const headers = { Authorization: `Bearer ${token}` }
    const search = await fetch(`${baseUrl}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/events/?query=${encodeURIComponent(`request_id:${requestId}`)}&full=true`, {
      headers,
      signal: AbortSignal.timeout(5000)
    })
    if (!search.ok) throw new Error(`Sentry trace search ${search.status}`)
    const events = await search.json() as Array<any>
    const event = events[0]
    if (!event) return { configured: true, available: true, spans: [] }
    const eventId = event.eventID || event.id
    const detailResponse = eventId
      ? await fetch(`${baseUrl}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/events/${encodeURIComponent(eventId)}/`, { headers, signal: AbortSignal.timeout(5000) })
      : null
    const detail = detailResponse?.ok ? await detailResponse.json() as any : event
    const traceContext = detail.contexts?.trace || detail.context?.trace || {}
    const spanEntry = (detail.entries || []).find((entry: any) => entry.type === 'spans')
    const childSpans = Array.isArray(spanEntry?.data) ? spanEntry.data : Array.isArray(detail.spans) ? detail.spans : []
    const spans = childSpans.map((span: any) => ({
      spanId: span.span_id || span.spanId,
      parentSpanId: span.parent_span_id || span.parentSpanId || null,
      traceId: span.trace_id || traceContext.trace_id || null,
      operation: span.op || 'operation',
      description: span.description || span.op || '未命名 span',
      startedAt: span.start_timestamp || span.startTimestamp || null,
      endedAt: span.timestamp || span.endTimestamp || null,
      status: span.status || 'unknown'
    })).filter((span: any) => span.spanId)
    const rootSpanId = traceContext.span_id || traceContext.spanId
    if (rootSpanId && !spans.some((span: any) => span.spanId === rootSpanId)) {
      spans.unshift({
        spanId: rootSpanId,
        parentSpanId: null,
        traceId: traceContext.trace_id || null,
        operation: traceContext.op || 'http.server',
        description: detail.transaction || detail.title || 'HTTP request',
        startedAt: detail.startTimestamp || detail.start_timestamp || null,
        endedAt: detail.endTimestamp || detail.timestamp || detail.dateCreated || null,
        status: traceContext.status || 'unknown'
      })
    }
    return { configured: true, available: true, traceId: traceContext.trace_id || spans[0]?.traceId || null, spans }
  } catch (error) {
    return { configured: true, available: false, error: error instanceof Error ? error.message : 'Sentry Trace 查询失败', spans: [] }
  }
}

const getBackupMonitorStatus = async () => {
  const [enabled, config] = await Promise.all([isAutoBackupEnabled(), getAutoBackupConfig()])
  return {
    enabled,
    targets: Object.fromEntries(Object.entries(config?.methods || {}).map(([name, target]) => [name, target?.enabled === true]))
  }
}

export default defineEventHandler(async (event) => {
  observeRuntimeDeployment(event.node.req.headers)
  const authResult = await verifyAdminAuth(event)
  if (!authResult.success) {
    throw createError({ statusCode: 401, message: authResult.message })
  }

  const query = getQuery(event)
  if (String(query.sentryOnly || '') === '1') {
    return { success: true, data: { sentry: await getSentryIssues() } }
  }

  const requestId = String(query.requestId || '').trim()
  const includeSentry = String(query.includeSentry || '') !== '0'
  const timelineHours = [1, 6, 24].includes(Number(query.timelineHours)) ? Number(query.timelineHours) : 24
  void triggerMusicSourceProbe()

  const [pool, database, diagnostics, businessQueue, apiKeyUsage, persistedRequests, recentLogs, timeline, dependencyTimeline, redis, backup, sentry, requestDiagnostics, securityEvents, ipBehavior, requestBehaviorTimeline, businessTimeline, sentryTrace] = await Promise.allSettled([
    databaseManager.getConnectionPoolStatus(),
    databaseManager.getPerformanceMetrics(),
    databaseManager.getDiagnostics(),
    databaseManager.getBusinessQueueStats(),
    databaseManager.getApiKeyUsageStats(),
    databaseManager.getPersistedRequestSamples(),
    databaseManager.getRecentApiLogs(),
    databaseManager.getOperationsMetricTimeline(timelineHours),
    databaseManager.getDependencyMetricTimeline(timelineHours),
    getRedisMetrics(),
    getBackupMonitorStatus(),
    includeSentry ? getSentryIssues() : Promise.resolve({ configured: false, issues: [] }),
    requestId ? databaseManager.getRequestDiagnostics(requestId) : Promise.resolve([]),
    databaseManager.getSecurityAuditEvents(),
    databaseManager.getIpBehaviorTimeline(),
    databaseManager.getRequestBehaviorTimeline(timelineHours),
    databaseManager.getBusinessOperationTimeline(timelineHours),
    requestId ? getSentryTrace(requestId) : Promise.resolve({ configured: false, available: false, spans: [] })
  ])

  const operationsMetrics = getOperationsMetrics()
  if (database.status === 'fulfilled' || diagnostics.status === 'fulfilled') {
    persistOperationsDatabaseSnapshot({
      queriesExecuted: database.status === 'fulfilled' ? database.value.queriesExecuted : null,
      activeConnections: database.status === 'fulfilled' ? database.value.activeConnections : null,
      totalConnections: pool.status === 'fulfilled' ? pool.value.totalConnections : null,
      slowQueryCount: diagnostics.status === 'fulfilled' ? diagnostics.value.slowQueries?.data?.length : null
    })
  }
  const logArchiveStats = await logManager.getLogStats()
  const logArchive = {
    ...logArchiveStats,
    currentLogFile: String(logArchiveStats.currentLogFile || '').replaceAll('\\', '/').split('/').pop() || ''
  }

  return {
    success: true,
    data: {
      metrics: operationsMetrics,
      redis: redis.status === 'fulfilled' ? redis.value : { ...getRedisStats(), metrics: null },
      backup: backup.status === 'fulfilled' ? backup.value : null,
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
        recentLogs: recentLogs.status === 'fulfilled' ? recentLogs.value : null,
        timeline: timeline.status === 'fulfilled' ? timeline.value : null,
        dependencyTimeline: dependencyTimeline.status === 'fulfilled' ? dependencyTimeline.value : null,
        logArchive,
        securityEvents: securityEvents.status === 'fulfilled' ? securityEvents.value.map((item: any) => ({ ...item, ip: maskIpAddress(item.ip) })) : null,
        ipBehavior: ipBehavior.status === 'fulfilled' ? ipBehavior.value.map((item: any) => ({ ...item, ip: maskIpAddress(item.ip) })) : null,
        requestBehaviorTimeline: requestBehaviorTimeline.status === 'fulfilled' ? requestBehaviorTimeline.value : null,
        businessTimeline: businessTimeline.status === 'fulfilled' ? businessTimeline.value : null
      },
      sentry: sentry.status === 'fulfilled' ? sentry.value : { configured: false, issues: [] },
      diagnostic: requestDiagnostics.status === 'fulfilled'
        ? { requestId, entries: requestDiagnostics.value, trace: sentryTrace.status === 'fulfilled' ? sentryTrace.value : { configured: false, available: false, spans: [] } }
        : { requestId, entries: [], trace: sentryTrace.status === 'fulfilled' ? sentryTrace.value : { configured: false, available: false, spans: [] } }
    }
  }
})
