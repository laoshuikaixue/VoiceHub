import { prisma } from '~/prisma/client'

// 断路器状态枚举
enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // 正常状态，允许请求通过
  OPEN = 'OPEN',         // 断路器打开，拒绝请求
  HALF_OPEN = 'HALF_OPEN' // 半开状态，允许少量请求测试
}

// 数据库连接池管理器
class DatabasePool {
  private isConnected = false
  private lastHealthCheck = 0
  private healthCheckInterval = 30000 // 30秒
  private connectionAttempts = 0
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000 // 最大延迟30秒
  
  // 断路器相关属性
  private circuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount = 0
  private failureThreshold = 5 // 失败阈值
  private recoveryTimeout = 60000 // 恢复超时时间（1分钟）
  private lastFailureTime = 0
  private successCount = 0
  private halfOpenMaxRequests = 3 // 半开状态下最大请求数
  
  // 性能监控相关属性
  private responseTimeHistory: number[] = [] // 响应时间历史记录
  private maxHistorySize = 100 // 最大历史记录数
  private averageResponseTime = 0 // 平均响应时间
  private slowQueryThreshold = 5000 // 慢查询阈值（5秒）
  private slowQueryCount = 0 // 慢查询计数
  private totalQueries = 0 // 总查询数
  private lastPerformanceCheck = 0 // 上次性能检查时间
  private performanceCheckInterval = 300000 // 性能检查间隔（5分钟）
  
  // 连接状态监控和日志相关属性
  private connectionEvents: Array<{timestamp: number, event: string, details?: string}> = [] // 连接事件历史
  private maxEventHistory = 50 // 最大事件历史记录数
  private errorStats: Map<string, number> = new Map() // 错误类型统计
  private connectionStartTime = Date.now() // 连接池启动时间
  private totalReconnects = 0 // 总重连次数
  private totalForceReconnects = 0 // 总强制重连次数
  private lastSuccessfulConnection = 0 // 上次成功连接时间
  private longestDowntime = 0 // 最长停机时间
  private currentDowntimeStart = 0 // 当前停机开始时间

  constructor() {
    this.logConnectionEvent('POOL_INITIALIZED', '数据库连接池启动')
    this.initialize()
  }
  
  // 记录连接事件
  private logConnectionEvent(event: string, details?: string): void {
    const eventRecord = {
      timestamp: Date.now(),
      event,
      details
    }
    
    this.connectionEvents.push(eventRecord)
    
    // 保持事件历史在限制范围内
    if (this.connectionEvents.length > this.maxEventHistory) {
      this.connectionEvents.shift()
    }
    
    // 输出详细日志
    const timestamp = new Date(eventRecord.timestamp).toISOString()
    if (details) {
      console.log(`[DB Pool] ${timestamp} - ${event}: ${details}`)
    } else {
      console.log(`[DB Pool] ${timestamp} - ${event}`)
    }
  }
  
  // 记录错误统计
  private recordErrorStats(errorType: string): void {
    const currentCount = this.errorStats.get(errorType) || 0
    this.errorStats.set(errorType, currentCount + 1)
  }
  
  // 分析错误类型
  private analyzeError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'UNKNOWN_ERROR'
    }
    
    const message = error.message.toLowerCase()
    
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR'
    } else if (message.includes('connection refused') || message.includes('econnrefused')) {
      return 'CONNECTION_REFUSED'
    } else if (message.includes('host') && message.includes('not found')) {
      return 'HOST_NOT_FOUND'
    } else if (message.includes('authentication') || message.includes('password')) {
      return 'AUTH_ERROR'
    } else if (message.includes('database') && message.includes('not exist')) {
      return 'DATABASE_NOT_FOUND'
    } else if (message.includes('network') || message.includes('socket')) {
      return 'NETWORK_ERROR'
    } else {
      return 'OTHER_ERROR'
    }
  }

  // 初始化连接池
  async initialize() {
    try {
      await this.ensureConnection()
      this.setupGracefulShutdown()
      console.log('[DB Pool] 数据库连接池初始化成功')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[DB Pool] 初始化失败:', errorMessage)
      // 初始化失败时不抛出错误，允许应用继续运行
    }
  }

  // 更新响应时间统计
  private updateResponseTimeStats(responseTime: number): void {
    this.responseTimeHistory.push(responseTime)
    
    // 保持历史记录在限制范围内
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift()
    }
    
    // 计算平均响应时间
    this.averageResponseTime = this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length
    
    // 统计慢查询
    if (responseTime > this.slowQueryThreshold) {
      this.slowQueryCount++
      console.warn(`[DB Pool] 检测到慢查询，响应时间: ${responseTime}ms`)
    }
    
    this.totalQueries++
  }
  
  // 性能健康检查
  private performPerformanceCheck(): void {
    const now = Date.now()
    
    if (now - this.lastPerformanceCheck < this.performanceCheckInterval) {
      return
    }
    
    this.lastPerformanceCheck = now
    
    // 计算慢查询比例
    const slowQueryRatio = this.totalQueries > 0 ? this.slowQueryCount / this.totalQueries : 0
    
    console.log(`[DB Pool] 性能统计 - 平均响应时间: ${this.averageResponseTime.toFixed(2)}ms, 慢查询比例: ${(slowQueryRatio * 100).toFixed(2)}%`)
    
    // 如果慢查询比例过高，考虑重连
    if (slowQueryRatio > 0.1 && this.totalQueries > 10) { // 超过10%的查询是慢查询
      console.warn('[DB Pool] 慢查询比例过高，考虑重连以优化性能')
      this.forceReconnect().catch(error => {
        console.error('[DB Pool] 性能优化重连失败:', error)
      })
    }
  }
  
  // 确保数据库连接
  async ensureConnection(): Promise<boolean> {
    const now = Date.now()
    
    // 如果最近检查过且连接正常，直接返回
    if (this.isConnected && (now - this.lastHealthCheck) < this.healthCheckInterval) {
      return true
    }

    try {
      const startTime = Date.now()
      
      // 执行健康检查
      await prisma.$queryRaw`SELECT 1 as health_check`
      
      const responseTime = Date.now() - startTime
      this.updateResponseTimeStats(responseTime)
      
      this.isConnected = true
      this.lastHealthCheck = now
      this.connectionAttempts = 0
      this.lastSuccessfulConnection = now
      
      // 如果之前处于断开状态，记录恢复事件
      if (this.currentDowntimeStart > 0) {
        const downtime = now - this.currentDowntimeStart
        this.longestDowntime = Math.max(this.longestDowntime, downtime)
        this.logConnectionEvent('CONNECTION_RESTORED', `连接已恢复，停机时长: ${downtime}ms`)
        this.currentDowntimeStart = 0
      }
      
      console.log(`[DB Pool] 数据库连接正常，响应时间: ${responseTime}ms`)
      
      // 执行性能检查
      this.performPerformanceCheck()
      
      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorType = this.analyzeError(error)
      
      console.error('[DB Pool] 连接检查失败:', errorMessage)
      
      this.isConnected = false
      
      // 记录连接失败事件和错误统计
      this.logConnectionEvent('CONNECTION_CHECK_FAILED', `错误类型: ${errorType}, 详情: ${errorMessage}`)
      this.recordErrorStats(errorType)
      
      // 开始记录停机时间
      if (this.currentDowntimeStart === 0) {
        this.currentDowntimeStart = Date.now()
      }

      // 尝试重新连接
      return await this.reconnect()
    }
  }

  // 强制重连（用于性能优化）
  async forceReconnect(): Promise<boolean> {
    console.log('[DB Pool] 执行强制重连以优化性能...')
    
    try {
      // 先断开现有连接
      await prisma.$disconnect()
      console.log('[DB Pool] 已断开现有连接')
      
      // 短暂等待
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 重新连接
      await prisma.$connect()
      console.log('[DB Pool] 强制重连成功')
      
      // 重置性能统计
      this.responseTimeHistory = []
      this.slowQueryCount = 0
      this.totalQueries = 0
      this.averageResponseTime = 0
      this.totalForceReconnects++
      
      this.logConnectionEvent('FORCE_RECONNECT_SUCCESS', '性能优化重连成功，统计已重置')
      
      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorType = this.analyzeError(error)
      
      console.error('[DB Pool] 强制重连失败:', errorMessage)
      this.logConnectionEvent('FORCE_RECONNECT_FAILED', `错误类型: ${errorType}, 详情: ${errorMessage}`)
      this.recordErrorStats(errorType)
      
      return false
    }
  }
  
  // 重新连接数据库
  async reconnect(): Promise<boolean> {
    console.log('[DB Pool] 开始重连数据库...')
    
    // 检查断路器状态
    if (!this.checkCircuitBreaker()) {
      console.log('[DB Pool] 断路器阻止重连尝试')
      return false
    }
    
    this.connectionAttempts++
    
    try {
      // 先断开现有连接
      await prisma.$disconnect()
      console.log('[DB Pool] 已断开现有连接')
      
      // 等待一段时间后重连
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay))
      
      // 尝试重新连接
      await prisma.$connect()
      console.log('[DB Pool] 重新连接成功')
      
      // 验证连接
      const isConnected = await this.ensureConnection()
      
      if (isConnected) {
        this.recordSuccess()
        this.totalReconnects++
        this.logConnectionEvent('RECONNECT_SUCCESS', `重连成功，尝试次数: ${this.connectionAttempts}`)
        console.log(`[DB Pool] 数据库重连成功，尝试次数: ${this.connectionAttempts}`)
        return true
      } else {
        throw new Error('连接验证失败')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorType = this.analyzeError(error)
      
      console.error(`[DB Pool] 重连失败 (尝试 ${this.connectionAttempts}):`, errorMessage)
      
      this.recordFailure()
      this.logConnectionEvent('RECONNECT_FAILED', `尝试 ${this.connectionAttempts}, 错误类型: ${errorType}, 详情: ${errorMessage}`)
      this.recordErrorStats(errorType)
      
      // 指数退避：增加重连延迟
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000) // 最大30秒
      
      // 继续尝试重连（无限重试）
      setTimeout(() => {
        this.reconnect().catch(retryError => {
          console.error('[DB Pool] 重连重试失败:', retryError)
        })
      }, this.reconnectDelay)
      
      return false
    }
  }

  // 检查断路器状态
  private checkCircuitBreaker(): boolean {
    const now = Date.now()
    
    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return true // 正常状态，允许请求
        
      case CircuitBreakerState.OPEN:
        // 检查是否到了恢复时间
        if (now - this.lastFailureTime >= this.recoveryTimeout) {
          console.log('[DB Pool] 断路器进入半开状态')
          this.circuitBreakerState = CircuitBreakerState.HALF_OPEN
          this.successCount = 0
          return true
        }
        return false // 断路器打开，拒绝请求
        
      case CircuitBreakerState.HALF_OPEN:
        return this.successCount < this.halfOpenMaxRequests
        
      default:
        return true
    }
  }
  
  // 记录操作成功
  private recordSuccess(): void {
    this.failureCount = 0
    
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.halfOpenMaxRequests) {
        console.log('[DB Pool] 断路器恢复到关闭状态')
        this.circuitBreakerState = CircuitBreakerState.CLOSED
        this.successCount = 0
      }
    }
  }
  
  // 记录操作失败
  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.failureThreshold) {
      console.log(`[DB Pool] 断路器打开，失败次数: ${this.failureCount}`)
      this.circuitBreakerState = CircuitBreakerState.OPEN
    }
  }
  
  // 执行数据库操作，带连接检查和断路器保护
  async execute<T>(operation: () => Promise<T>, operationName = 'Unknown'): Promise<T> {
    // 检查断路器状态
    if (!this.checkCircuitBreaker()) {
      const error = new Error(`数据库断路器已打开，拒绝执行操作: ${operationName}`)
      console.warn(`[DB Pool] ${error.message}`)
      throw error
    }
    
    // 确保连接可用
    const isConnected = await this.ensureConnection()
    
    if (!isConnected) {
      this.recordFailure()
      throw new Error('数据库连接不可用')
    }

    try {
      console.log(`[DB Pool] 执行操作: ${operationName}`)
      const result = await operation()
      console.log(`[DB Pool] 操作成功: ${operationName}`)
      
      // 记录成功
      this.recordSuccess()
      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[DB Pool] 操作失败: ${operationName}`, errorMessage)
      
      // 记录失败
      this.recordFailure()
      
      // 检查是否是连接错误
      const isConnectionError = errorMessage.includes('ECONNRESET') ||
                               errorMessage.includes('ENOTFOUND') ||
                               errorMessage.includes('ETIMEDOUT') ||
                               errorMessage.includes('Connection terminated') ||
                               errorMessage.includes('Connection lost') ||
                               errorMessage.includes('Server has gone away')
      
      if (isConnectionError) {
        console.log(`[DB Pool] 检测到连接错误，标记连接为不可用`)
        this.isConnected = false
        
        // 执行按需健康检查
        const healthCheckPassed = await this.performOnDemandHealthCheck(operationName)
        
        // 只有在断路器允许且健康检查通过的情况下才尝试重连
        if (healthCheckPassed && this.checkCircuitBreaker()) {
          const reconnected = await this.reconnect()
          if (reconnected) {
            console.log(`[DB Pool] 重连成功，重试操作: ${operationName}`)
            try {
              const result = await operation()
              this.recordSuccess() // 重试成功，记录成功
              return result
            } catch (retryError: unknown) {
              const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError)
              console.error(`[DB Pool] 重试操作失败: ${operationName}`, retryErrorMessage)
              this.recordFailure() // 重试失败，记录失败
              throw retryError
            }
          }
        }
      }

      throw error
    }
  }

  // 按需健康检查（仅在请求出错时触发）
  async performOnDemandHealthCheck(operationName: string): Promise<boolean> {
    try {
      const startTime = Date.now()
      console.log(`[DB Pool] 执行按需健康检查 - 操作: ${operationName}`)
      
      const isHealthy = await this.ensureConnection()
      const checkDuration = Date.now() - startTime
      
      if (!isHealthy) {
        console.warn(`[DB Pool] 按需健康检查失败，连接不可用 - 操作: ${operationName}`)
        this.logConnectionEvent('ON_DEMAND_HEALTH_CHECK_FAILED', `操作: ${operationName}`)
        return false
      } else {
        console.log(`[DB Pool] 按需健康检查成功，响应时间: ${checkDuration}ms - 操作: ${operationName}`)
        this.logConnectionEvent('ON_DEMAND_HEALTH_CHECK_SUCCESS', `操作: ${operationName}, 响应时间: ${checkDuration}ms`)
        
        // 检查健康检查本身的性能
        if (checkDuration > this.slowQueryThreshold) {
          console.warn(`[DB Pool] 健康检查响应缓慢: ${checkDuration}ms - 操作: ${operationName}`)
        }
        return true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[DB Pool] 按需健康检查异常 - 操作: ${operationName}:`, errorMessage)
      this.logConnectionEvent('ON_DEMAND_HEALTH_CHECK_ERROR', `操作: ${operationName}, 错误: ${errorMessage}`)
      return false
    }
  }

  // 获取连接状态（增强版）
  getStatus() {
    const now = Date.now()
    const slowQueryRatio = this.totalQueries > 0 ? this.slowQueryCount / this.totalQueries : 0
    const uptime = now - this.connectionStartTime
    const currentDowntime = this.currentDowntimeStart > 0 ? now - this.currentDowntimeStart : 0
    
    // 转换错误统计为对象
    const errorStatsObj: Record<string, number> = {}
    this.errorStats.forEach((count, errorType) => {
      errorStatsObj[errorType] = count
    })
    
    return {
      // 基本连接信息
      connection: {
        isConnected: this.isConnected,
        connectionAttempts: this.connectionAttempts,
        lastHealthCheck: this.lastHealthCheck ? new Date(this.lastHealthCheck).toISOString() : null,
        lastSuccessfulConnection: this.lastSuccessfulConnection ? new Date(this.lastSuccessfulConnection).toISOString() : null,
        healthCheckInterval: this.healthCheckInterval,
        reconnectDelay: this.reconnectDelay
      },
      
      // 断路器状态
      circuitBreaker: {
        state: this.circuitBreakerState,
        failureCount: this.failureCount,
        failureThreshold: this.failureThreshold,
        lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
        recoveryTimeout: this.recoveryTimeout,
        successCount: this.successCount
      },
      
      // 性能监控状态
      performance: {
        averageResponseTime: Math.round(this.averageResponseTime * 100) / 100,
        totalQueries: this.totalQueries,
        slowQueryCount: this.slowQueryCount,
        slowQueryRatio: Math.round(slowQueryRatio * 10000) / 100,
        slowQueryThreshold: this.slowQueryThreshold,
        responseTimeHistorySize: this.responseTimeHistory.length,
        lastPerformanceCheck: this.lastPerformanceCheck ? new Date(this.lastPerformanceCheck).toISOString() : null,
        performanceCheckInterval: this.performanceCheckInterval
      },
      
      // 运行时统计
      runtime: {
        startTime: new Date(this.connectionStartTime).toISOString(),
        uptime: uptime,
        uptimeFormatted: this.formatDuration(uptime),
        totalReconnects: this.totalReconnects,
        totalForceReconnects: this.totalForceReconnects,
        longestDowntime: this.longestDowntime,
        longestDowntimeFormatted: this.formatDuration(this.longestDowntime),
        currentDowntime: currentDowntime,
        currentDowntimeFormatted: this.formatDuration(currentDowntime)
      },
      
      // 错误统计
      errors: {
        totalErrors: Array.from(this.errorStats.values()).reduce((sum, count) => sum + count, 0),
        errorsByType: errorStatsObj,
        mostCommonError: this.getMostCommonError()
      },
      
      // 连接事件历史（最近的事件）
      recentEvents: this.connectionEvents.slice(-10).map(event => ({
        timestamp: new Date(event.timestamp).toISOString(),
        event: event.event,
        details: event.details
      })),
      
      // 监控配置
      config: {
        maxEventHistory: this.maxEventHistory,
        maxHistorySize: this.maxHistorySize,
        failureThreshold: this.failureThreshold,
        recoveryTimeout: this.recoveryTimeout,
        halfOpenMaxRequests: this.halfOpenMaxRequests
      }
    }
  }
  
  // 格式化持续时间
  private formatDuration(ms: number): string {
    if (ms === 0) return '0ms'
    
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`
    } else if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`
    } else if (seconds > 0) {
      return `${seconds}秒`
    } else {
      return `${ms}ms`
    }
  }
  
  // 获取最常见的错误类型
  private getMostCommonError(): string | null {
    if (this.errorStats.size === 0) return null
    
    let maxCount = 0
    let mostCommonError = ''
    
    this.errorStats.forEach((count, errorType) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonError = errorType
      }
    })
    
    return mostCommonError || null
  }



  // 设置优雅关闭
  setupGracefulShutdown() {
    const cleanup = async () => {
      console.log('[DB Pool] 应用关闭，清理数据库连接...')
      try {
        await prisma.$disconnect()
        console.log('[DB Pool] 数据库连接已清理')
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[DB Pool] 清理连接时出错:', errorMessage)
      }
    }

    // 监听各种退出信号
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('beforeExit', cleanup)

    // 处理未捕获的异常
    process.on('uncaughtException', (error: Error) => {
      console.error('[DB Pool] 未捕获的异常:', error.message)
      cleanup().finally(() => process.exit(1))
    })

    process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
      const reasonMessage = reason instanceof Error ? reason.message : String(reason)
      console.error('[DB Pool] 未处理的Promise拒绝:', reasonMessage)
      // 不立即退出，记录错误并继续运行
      if (reasonMessage.includes('ECONNRESET')) {
        console.log('[DB Pool] 检测到连接重置，标记连接为不可用')
        this.isConnected = false
      }
    })
  }
}

// 创建全局连接池实例
export const dbPool = new DatabasePool()

// 便捷函数
export async function executeWithPool<T>(
  operation: () => Promise<T>, 
  operationName?: string
): Promise<T> {
  return dbPool.execute(operation, operationName)
}

export function getPoolStatus() {
  return dbPool.getStatus()
}
