import { db, getConnectionStatus } from '~/drizzle/db'
import { sql } from 'drizzle-orm'
import {
  getConnectionPoolStatus,
  getDatabaseMetrics,
  getDatabaseDiagnostics
} from './database-health'
import { getServerTimestamp } from './serverTime'

/**
 * 数据库管理器
 */
export class DatabaseManager {
  private static instance: DatabaseManager
  private healthCheckCache: { status: boolean; timestamp: number; latency: number } | null = null
  private readonly CACHE_TTL = 30000 // 30秒缓存

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  /**
   * 数据库健康检查（带缓存）
   */
  async healthCheck(): Promise<{
    status: boolean
    latency: number
    timestamp: Date
    connectionStatus: string
    error?: string
  }> {
    const now = getServerTimestamp()

    // 检查缓存
    if (this.healthCheckCache && now - this.healthCheckCache.timestamp < this.CACHE_TTL) {
      return {
        status: this.healthCheckCache.status,
        latency: this.healthCheckCache.latency,
        timestamp: new Date(this.healthCheckCache.timestamp),
        connectionStatus: 'cached'
      }
    }

    const startTime = Date.now()
    try {
      // 获取连接状态
      const connectionStatus = await getConnectionStatus()

      // 执行简单查询测试连接
      await db.execute(sql`SELECT 1 as health_check`)

      const latency = Date.now() - startTime
      const result = {
        status: true,
        latency,
        timestamp: new Date(),
        connectionStatus: connectionStatus.status
      }

      // 更新缓存
      this.healthCheckCache = {
        status: true,
        timestamp: now,
        latency
      }

      return result
    } catch (error) {
      const latency = Date.now() - startTime
      const result = {
        status: false,
        latency,
        timestamp: new Date(),
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      // 更新缓存
      this.healthCheckCache = {
        status: false,
        timestamp: now,
        latency
      }

      return result
    }
  }

  /**
   * 获取基础数据库信息 - 简化版本适配 Neon Database
   */
  async getBasicMetrics(): Promise<{
    databaseSize: string
    activeConnections: number
    serverless: boolean
  }> {
    try {
      // 获取数据库大小
      const sizeResult = await db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
      `)

      // 获取当前连接数（简化版）
      const connectionStats = await db.execute(sql`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE datname = current_database() AND state = 'active'
      `)

      const sizeRow = sizeResult[0] as { database_size?: string } | undefined
      const connectionRow = connectionStats[0] as { active_connections?: number | string } | undefined

      return {
        databaseSize: sizeRow?.database_size || 'Unknown',
        activeConnections:
          Number.parseInt(String(connectionRow?.active_connections ?? '0'), 10) || 0,
        serverless: true // Neon Database 是无服务器架构
      }
    } catch (error) {
      console.error('[DatabaseManager] Failed to get basic metrics:', error)
      throw new Error(
        `Failed to retrieve basic metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * 获取连接状态 - 适配 Neon Database 无服务器架构
   */
  async getConnectionStatus(): Promise<{
    connected: boolean
    status: string
    activeConnections: number
    serverlessMode: boolean
    autoSuspend: boolean
    error: string | null
  }> {
    try {
      const connectionStatus = await getConnectionStatus()

      // 用最小查询判断真实连通性，避免底层连接对象状态或统计查询误判。
      await db.execute(sql`SELECT 1 as connection_check`)

      // 获取当前活跃连接数
      let activeConnections = 0
      try {
        const connectionStats = await db.execute(sql`
          SELECT count(*) as active_connections
          FROM pg_stat_activity
          WHERE datname = current_database() AND state = 'active'
        `)

        const connRow = connectionStats[0] as { active_connections?: number | string } | undefined
        activeConnections = Number.parseInt(String(connRow?.active_connections ?? '0'), 10) || 0
      } catch (metricsError) {
        console.warn('Failed to get active connection count:', metricsError)
      }

      return {
        connected: true,
        status: connectionStatus.status || 'connected',
        activeConnections,
        serverlessMode: true, // Neon Database 是无服务器架构
        autoSuspend: true, // 支持自动暂停
        error: null
      }
    } catch (error) {
      console.error('Failed to get connection status:', error)
      return {
        connected: false,
        status: 'error',
        activeConnections: 0,
        serverlessMode: true,
        autoSuspend: true,
        error: error instanceof Error ? error.message : 'Failed to retrieve connection status'
      }
    }
  }

  /**
   * 获取连接池状态
   */
  async getConnectionPoolStatus() {
    return await getConnectionPoolStatus()
  }

  /**
   * 获取数据库性能指标
   */
  async getPerformanceMetrics() {
    return await getDatabaseMetrics()
  }

  async getDiagnostics() {
    return await getDatabaseDiagnostics()
  }

  async getBusinessQueueStats() {
    const result = await db.execute(sql`
      SELECT count(*)::int AS pending_count, min("createdAt") AS oldest_created_at
      FROM "Song"
      WHERE played = false
    `)
    const row = result[0] as { pending_count?: number | string; oldest_created_at?: Date | string | null } | undefined
    return {
      pendingCount: Number(row?.pending_count || 0),
      oldestCreatedAt: row?.oldest_created_at || null
    }
  }

  async getApiKeyUsageStats() {
    const result = await db.execute(sql`
      SELECT count(*)::int AS calls,
        count(*) FILTER (WHERE "status_code" >= 400)::int AS failures
      FROM api_logs
      WHERE "created_at" >= now() - interval '5 minutes' AND "api_key_id" IS NOT NULL
    `)
    const row = result[0] as { calls?: number | string; failures?: number | string } | undefined
    const calls = Number(row?.calls || 0)
    const failures = Number(row?.failures || 0)
    return {
      calls,
      failureRate: calls ? Number((failures / calls * 100).toFixed(2)) : null
    }
  }

  async getPersistedRequestSamples() {
    const result = await db.execute(sql`
      SELECT "created_at" AS at, "endpoint" AS route, "method", "status_code" AS status,
        "response_time_ms" AS "durationMs",
        substring("error_message" from 'requestId=([^ ]+)') AS "requestId"
      FROM api_logs
      WHERE "api_key_id" IS NULL
        AND "error_message" LIKE '%requestId=%'
      ORDER BY "created_at" DESC
      LIMIT 50
    `)
    return result
  }

  async getRecentApiLogs() {
    return await db.execute(sql`
      SELECT "created_at" AS at, "endpoint" AS route, "method", "status_code" AS status,
        "response_time_ms" AS "durationMs", "error_message" AS "errorMessage",
        substring("error_message" from 'requestId=([^ ]+)') AS "requestId"
      FROM api_logs
      ORDER BY "created_at" DESC
      LIMIT 100
    `)
  }

  async getRequestDiagnostics(requestId: string) {
    const normalized = String(requestId || '').trim()
    if (!normalized) return []
    return await db.execute(sql`
      SELECT "created_at" AS at, "endpoint" AS route, "method", "status_code" AS status,
        "response_time_ms" AS "durationMs", "error_message" AS "errorMessage",
        substring("error_message" from 'requestId=([^ ]+)') AS "requestId"
      FROM api_logs
      WHERE "error_message" LIKE ${`%requestId=${normalized}%`}
      ORDER BY "created_at" ASC
      LIMIT 100
    `)
  }

  async getSecurityAuditEvents() {
    return await db.execute(sql`
      SELECT * FROM (
        SELECT created_at AS at, action AS event, result AS severity,
          summary, ip_address AS ip, request_id AS "requestId", 'ADMIN_OPERATION' AS source
        FROM admin_operation_logs
        WHERE created_at >= now() - interval '24 hours'
        UNION ALL
        SELECT created_at AS at, endpoint AS event,
          CASE WHEN status_code >= 500 THEN 'ERROR' ELSE 'WARNING' END AS severity,
          concat(method, ' ', endpoint, ' 返回 ', status_code) AS summary,
          ip_address AS ip,
          substring(error_message from 'requestId=([^ ]+)') AS "requestId",
          'HTTP' AS source
        FROM api_logs
        WHERE created_at >= now() - interval '24 hours'
          AND (status_code IN (401, 403, 429) OR status_code >= 500)
      ) events
      ORDER BY at DESC
      LIMIT 100
    `)
  }

  async getIpBehaviorTimeline() {
    return await db.execute(sql`
      SELECT ip_address AS ip,
        count(*)::int AS requests,
        count(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::int AS client_errors,
        count(*) FILTER (WHERE status_code >= 500)::int AS server_errors,
        min(created_at) AS first_seen,
        max(created_at) AS last_seen,
        (array_agg(endpoint ORDER BY created_at DESC))[1] AS last_route
      FROM api_logs
      WHERE created_at >= now() - interval '24 hours'
      GROUP BY ip_address
      ORDER BY count(*) FILTER (WHERE status_code >= 400) DESC, count(*) DESC
      LIMIT 50
    `)
  }

  async getRequestBehaviorTimeline(hours = 24) {
    return await db.execute(sql`
      SELECT date_trunc('hour', created_at) AS at,
        count(*)::int AS requests,
        count(*) FILTER (WHERE status_code >= 400)::int AS errors,
        count(*) FILTER (WHERE status_code >= 500)::int AS server_errors,
        count(DISTINCT ip_address)::int AS unique_clients,
        count(*) FILTER (WHERE endpoint NOT LIKE '/api/admin/%')::int AS user_requests
      FROM api_logs
      WHERE created_at >= now() - (${hours} * interval '1 hour')
      GROUP BY date_trunc('hour', created_at)
      ORDER BY at ASC
    `)
  }

  async getBusinessOperationTimeline(hours = 24) {
    return await db.execute(sql`
      WITH events AS (
        SELECT date_trunc('hour', "createdAt") AS at, count(*)::int AS song_requests,
          0::int AS schedules_created, 0::int AS schedules_published,
          0::int AS schedules_played, 0::int AS votes
        FROM "Song"
        WHERE "createdAt" >= now() - (${hours} * interval '1 hour')
        GROUP BY date_trunc('hour', "createdAt")
        UNION ALL
        SELECT date_trunc('hour', "createdAt") AS at, 0, count(*)::int,
          0, 0, 0
        FROM "Schedule"
        WHERE "createdAt" >= now() - (${hours} * interval '1 hour')
        GROUP BY date_trunc('hour', "createdAt")
        UNION ALL
        SELECT date_trunc('hour', "publishedAt") AS at, 0, 0, count(*)::int, 0, 0
        FROM "Schedule"
        WHERE "publishedAt" >= now() - (${hours} * interval '1 hour')
        GROUP BY date_trunc('hour', "publishedAt")
        UNION ALL
        SELECT date_trunc('hour', "playedAt") AS at, 0, 0, 0, count(*)::int, 0
        FROM "Song"
        WHERE played = true AND "playedAt" >= now() - (${hours} * interval '1 hour')
        GROUP BY date_trunc('hour', "playedAt")
        UNION ALL
        SELECT date_trunc('hour', "createdAt") AS at, 0, 0, 0, 0, count(*)::int
        FROM "Vote"
        WHERE "createdAt" >= now() - (${hours} * interval '1 hour')
        GROUP BY date_trunc('hour', "createdAt")
      )
      SELECT at, sum(song_requests)::int AS song_requests,
        sum(schedules_created)::int AS schedules_created,
        sum(schedules_published)::int AS schedules_published,
        sum(schedules_played)::int AS schedules_played,
        sum(votes)::int AS votes
      FROM events
      GROUP BY at
      ORDER BY at ASC
    `)
  }

  async getOperationsMetricTimeline(hours = 24) {
    return await db.execute(sql`
      WITH buckets AS (
        SELECT bucket_start,
          sum(request_count)::int AS requests,
          sum(server_error_count)::int AS errors,
          round(sum(total_duration_ms)::numeric / nullif(sum(request_count), 0), 2) AS average_duration_ms,
          max(max_duration_ms)::int AS max_duration_ms,
          round(avg(cpu_usage_percent)::numeric, 2) AS cpu_usage_percent,
          max(memory_used_bytes)::numeric AS memory_used_bytes,
          max(memory_total_bytes)::numeric AS memory_total_bytes,
          max(disk_used_bytes)::numeric AS disk_used_bytes,
          max(disk_total_bytes)::numeric AS disk_total_bytes,
          max(network_rx_bytes)::numeric AS network_rx_bytes,
          max(network_tx_bytes)::numeric AS network_tx_bytes,
          max(database_query_total)::numeric AS database_query_total,
          max(database_active_connections)::int AS database_active_connections,
          max(database_total_connections)::int AS database_total_connections,
          max(database_slow_query_count)::int AS database_slow_query_count
        FROM operations_metric_buckets
        WHERE bucket_start >= now() - (${hours} * interval '1 hour')
        GROUP BY bucket_start
      ), deltas AS (
        SELECT *,
          GREATEST(network_rx_bytes - lag(network_rx_bytes) OVER (ORDER BY bucket_start), 0) AS network_rx_delta,
          GREATEST(network_tx_bytes - lag(network_tx_bytes) OVER (ORDER BY bucket_start), 0) AS network_tx_delta,
          GREATEST(database_query_total - lag(database_query_total) OVER (ORDER BY bucket_start), 0) AS database_query_delta
        FROM buckets
      )
      SELECT bucket_start AS at, requests, errors, average_duration_ms, max_duration_ms,
        cpu_usage_percent,
        round(memory_used_bytes / 1048576, 1) AS memory_used_mb,
        round(memory_total_bytes / 1048576, 1) AS memory_total_mb,
        round(disk_used_bytes / 1048576, 1) AS disk_used_mb,
        round(disk_total_bytes / 1048576, 1) AS disk_total_mb,
        round(network_rx_delta / 1048576, 2) AS network_rx_mb,
        round(network_tx_delta / 1048576, 2) AS network_tx_mb,
        database_query_delta::int AS database_queries,
        database_active_connections,
        database_total_connections,
        database_slow_query_count
      FROM deltas
      ORDER BY bucket_start ASC
    `)
  }

  async getDependencyMetricTimeline(hours = 24) {
    return await db.execute(sql`
      SELECT bucket_start AS at, source,
        sum(call_count)::int AS calls,
        sum(success_count)::int AS successes,
        sum(empty_result_count)::int AS empty_results,
        sum(semantic_failure_count)::int AS semantic_failures,
        sum(timeout_count)::int AS timeouts,
        sum(retry_count)::int AS retries,
        sum(fallback_count)::int AS fallbacks,
        round(sum(total_duration_ms)::numeric / nullif(sum(call_count), 0), 2) AS average_duration_ms,
        max(max_duration_ms)::int AS max_duration_ms
      FROM operations_dependency_buckets
      WHERE bucket_start >= now() - (${hours} * interval '1 hour')
      GROUP BY bucket_start, source
      ORDER BY bucket_start ASC
    `)
  }

  /**
   * 批量清理过期会话
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db.execute(sql`
        DELETE FROM user_sessions
        WHERE expires_at < NOW()
          OR revoked_at < NOW() - interval '30 days'
      `)

      // postgres-js returns count in the result array object properties
      const deleteResult = result as { count?: number | string }
      return Number.parseInt(String(deleteResult.count ?? '0'), 10) || 0
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error)
      throw new Error('Failed to cleanup expired sessions')
    }
  }

  /**
   * 清除健康检查缓存
   */
  clearHealthCheckCache(): void {
    this.healthCheckCache = null
  }

  /**
   * 获取数据库管理器状态
   */
  getManagerStatus(): {
    cacheEnabled: boolean
    cacheTTL: number
    lastHealthCheck: Date | null
  } {
    return {
      cacheEnabled: true,
      cacheTTL: this.CACHE_TTL,
      lastHealthCheck: this.healthCheckCache ? new Date(this.healthCheckCache.timestamp) : null
    }
  }
}

// 导出单例实例
export const databaseManager = DatabaseManager.getInstance()
