import { db, getConnectionStatus } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

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
    const now = Date.now()

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

      const sizeRow = sizeResult[0] as any
      const connectionRow = connectionStats[0] as any

      return {
        databaseSize: sizeRow?.database_size || 'Unknown',
        activeConnections: parseInt(connectionRow?.active_connections) || 0,
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
    status: string
    activeConnections: number
    serverlessMode: boolean
    autoSuspend: boolean
  }> {
    try {
      const connectionStatus = await getConnectionStatus()

      // 获取当前活跃连接数
      const connectionStats = await db.execute(sql`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE datname = current_database() AND state = 'active'
      `)

      const connRow = connectionStats[0] as any

      return {
        status: connectionStatus.status,
        activeConnections: parseInt(connRow?.active_connections) || 0,
        serverlessMode: true, // Neon Database 是无服务器架构
        autoSuspend: true // 支持自动暂停
      }
    } catch (error) {
      console.error('Failed to get connection status:', error)
      throw new Error('Failed to retrieve connection status')
    }
  }

  /**
   * 批量清理过期会话
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db.execute(sql`
        DELETE FROM session 
        WHERE expires_at < NOW()
      `)

      // postgres-js returns count in the result array object properties
      return (result as any).count || 0
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
