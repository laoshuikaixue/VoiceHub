import { db } from '~/drizzle/db';
import { sql } from 'drizzle-orm';

/**
 * 数据库连接管理器
 * 基于official-website项目的最佳实践
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private healthCheckCache: { status: boolean; timestamp: number } | null = null;
  private readonly CACHE_TTL = 30000; // 30秒缓存

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * 数据库健康检查（带缓存）
   */
  async healthCheck(): Promise<{
    status: boolean;
    latency: number;
    timestamp: Date;
    error?: string;
  }> {
    const now = Date.now();
    
    // 检查缓存
    if (this.healthCheckCache && 
        (now - this.healthCheckCache.timestamp) < this.CACHE_TTL) {
      return {
        status: this.healthCheckCache.status,
        latency: 0, // 缓存命中，延迟为0
        timestamp: new Date(this.healthCheckCache.timestamp),
      };
    }

    const startTime = Date.now();
    try {
      // 执行简单查询测试连接
      await db.execute(sql`SELECT 1 as health_check`);
      
      const latency = Date.now() - startTime;
      const result = {
        status: true,
        latency,
        timestamp: new Date(),
      };

      // 更新缓存
      this.healthCheckCache = {
        status: true,
        timestamp: now,
      };

      return result;
    } catch (error) {
      const result = {
        status: false,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      // 更新缓存
      this.healthCheckCache = {
        status: false,
        timestamp: now,
      };

      return result;
    }
  }

  /**
   * 获取数据库性能指标
   */
  async getPerformanceMetrics(): Promise<{
    activeConnections: number;
    totalConnections: number;
    idleConnections: number;
    slowQueries: Array<{
      query: string;
      avgTime: number;
      calls: number;
    }>;
    databaseSize: string;
    uptime: string;
    transactionStats: {
      commits: number;
      rollbacks: number;
    };
  }> {
    try {
      console.log('[DatabaseManager] Getting performance metrics...');
      // 获取连接统计
      const connectionStats = await db.execute(sql`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      // 获取慢查询（如果pg_stat_statements可用）
      let slowQueries: Array<{ query: string; avgTime: number; calls: number }> = [];
      try {
        const slowQueryResult = await db.execute(sql`
          SELECT 
            query,
            mean_exec_time as avg_time,
            calls
          FROM pg_stat_statements 
          WHERE mean_exec_time > 100
          ORDER BY mean_exec_time DESC
          LIMIT 5
        `);
        
        slowQueries = slowQueryResult.map((row: any) => ({
          query: row.query.substring(0, 100) + '...',
          avgTime: Math.round(row.avg_time * 100) / 100,
          calls: row.calls,
        }));
      } catch {
        // pg_stat_statements 可能未启用，忽略错误
      }

      // 获取数据库大小
      const sizeResult = await db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
      `);

      // 获取数据库运行时间
      const uptimeResult = await db.execute(sql`
        SELECT 
          EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int as uptime_seconds
      `);

      // 获取事务统计
      const transactionResult = await db.execute(sql`
        SELECT 
          xact_commit as commits,
          xact_rollback as rollbacks
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      console.log('[DatabaseManager] Connection stats result:', connectionStats);
      console.log('[DatabaseManager] Size result:', sizeResult);
      console.log('[DatabaseManager] Uptime result:', uptimeResult);

      const connectionRow = connectionStats[0] as any;
      const sizeRow = sizeResult[0] as any;
      const uptimeRow = uptimeResult[0] as any;
      const transactionRow = transactionResult[0] as any;

      if (!connectionRow) {
        throw new Error('No connection statistics available');
      }
      if (!sizeRow) {
        throw new Error('No database size information available');
      }
      if (!uptimeRow) {
        throw new Error('No uptime information available');
      }
      if (!transactionRow) {
        throw new Error('No transaction statistics available');
      }

      // 格式化运行时间
      const uptimeSeconds = uptimeRow.uptime_seconds;
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const uptime = `${days}d ${hours}h ${minutes}m`;

      return {
        activeConnections: parseInt(connectionRow.active_connections) || 0,
        totalConnections: parseInt(connectionRow.total_connections) || 0,
        idleConnections: parseInt(connectionRow.idle_connections) || 0,
        slowQueries,
        databaseSize: sizeRow.database_size || 'Unknown',
        uptime,
        transactionStats: {
          commits: parseInt(transactionRow.commits) || 0,
          rollbacks: parseInt(transactionRow.rollbacks) || 0,
        },
      };
    } catch (error) {
      console.error('[DatabaseManager] Failed to get performance metrics:', error);
      console.error('[DatabaseManager] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to retrieve performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取连接池状态
   */
  async getConnectionPoolStatus(): Promise<{
    poolSize: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    maxConnections: number;
    poolMode: string;
  }> {
    try {
      // 获取连接池信息
      const poolStats = await db.execute(sql`
        SELECT 
          setting as max_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      `);

      const connectionStats = await db.execute(sql`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event_type = 'Client') as waiting_clients
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const maxConnRow = poolStats[0] as any;
      const connRow = connectionStats[0] as any;

      return {
        poolSize: parseInt(connRow.total_connections) || 0,
        activeConnections: parseInt(connRow.active_connections) || 0,
        idleConnections: parseInt(connRow.idle_connections) || 0,
        waitingClients: parseInt(connRow.waiting_clients) || 0,
        maxConnections: parseInt(maxConnRow.max_connections) || 100,
        poolMode: 'transaction', // 假设使用事务级连接池
      };
    } catch (error) {
      console.error('Failed to get connection pool status:', error);
      throw new Error('Failed to retrieve connection pool status');
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
      `);
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      throw new Error('Failed to cleanup expired sessions');
    }
  }



  /**
   * 清除健康检查缓存
   */
  clearHealthCheckCache(): void {
    this.healthCheckCache = null;
  }
}

// 导出单例实例
export const databaseManager = DatabaseManager.getInstance();