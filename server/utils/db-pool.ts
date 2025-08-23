import { prisma } from '~/prisma/client'

// 数据库连接池管理器
class DatabasePool {
  private isConnected = false
  private lastHealthCheck = 0
  private healthCheckInterval = 30000 // 30秒
  private connectionAttempts = 0
  // 移除最大重连次数限制，实现无限重试
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000 // 最大延迟30秒

  constructor() {
    this.initialize()
  }

  // 初始化连接池
  async initialize() {
    try {
      await this.ensureConnection()
      this.startPeriodicHealthCheck()
      this.setupGracefulShutdown()
      console.log('[DB Pool] 数据库连接池初始化成功')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[DB Pool] 初始化失败:', errorMessage)
      // 初始化失败时不抛出错误，允许应用继续运行
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
      // 执行健康检查
      await prisma.$queryRaw`SELECT 1 as health_check`
      this.isConnected = true
      this.lastHealthCheck = now
      this.connectionAttempts = 0
      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[DB Pool] 连接检查失败:', errorMessage)
      this.isConnected = false

      // 尝试重新连接
      return await this.reconnect()
    }
  }

  // 重新连接数据库 - 无限重试机制
  async reconnect(): Promise<boolean> {
    this.connectionAttempts++
    console.log(`[DB Pool] 尝试重连 (第${this.connectionAttempts}次)`)

    try {
      // 断开现有连接（忽略错误）
      try {
        await prisma.$disconnect()
      } catch (disconnectError: unknown) {
        const errorMessage = disconnectError instanceof Error ? disconnectError.message : String(disconnectError)
        console.log('[DB Pool] 断开连接时出错（忽略）:', errorMessage)
      }

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay))

      // 重新连接
      await prisma.$connect()

      // 测试连接
      await prisma.$queryRaw`SELECT 1 as reconnect_test`

      this.isConnected = true
      this.lastHealthCheck = Date.now()
      this.connectionAttempts = 0
      this.reconnectDelay = 1000 // 重置延迟

      console.log('[DB Pool] 重连成功')
      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[DB Pool] 重连失败 (尝试 ${this.connectionAttempts}):`, errorMessage)

      // 增加延迟时间，使用指数退避，但不放弃重试
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay)
      
      // 等待后继续重试
      console.log(`[DB Pool] ${this.reconnectDelay}ms后将继续重试...`)
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay))
      
      // 递归调用，实现无限重试
      return await this.reconnect()
    }
  }

  // 执行数据库操作，带连接检查
  async execute<T>(operation: () => Promise<T>, operationName = 'Unknown'): Promise<T> {
    // 确保连接可用
    const isConnected = await this.ensureConnection()
    
    if (!isConnected) {
      throw new Error('数据库连接不可用')
    }

    try {
      console.log(`[DB Pool] 执行操作: ${operationName}`)
      const result = await operation()
      console.log(`[DB Pool] 操作成功: ${operationName}`)
      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[DB Pool] 操作失败: ${operationName}`, errorMessage)

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

        // 尝试重新连接并重试操作（只重试一次）
        const reconnected = await this.reconnect()
        if (reconnected) {
          console.log(`[DB Pool] 重连成功，重试操作: ${operationName}`)
          try {
            return await operation()
          } catch (retryError: unknown) {
            const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError)
            console.error(`[DB Pool] 重试操作失败: ${operationName}`, retryErrorMessage)
            throw retryError
          }
        }
      }

      throw error
    }
  }

  // 定期健康检查
  startPeriodicHealthCheck() {
    setInterval(async () => {
      try {
        await this.ensureConnection()
      } catch (error) {
        console.error('[DB Pool] 定期健康检查失败:', error)
      }
    }, this.healthCheckInterval)
  }

  // 获取连接状态
  getStatus() {
    return {
      connected: this.isConnected,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      connectionAttempts: this.connectionAttempts,
      nextHealthCheck: new Date(this.lastHealthCheck + this.healthCheckInterval).toISOString()
    }
  }

  // 强制重连
  async forceReconnect() {
    console.log('[DB Pool] 强制重连')
    this.isConnected = false
    this.connectionAttempts = 0
    return await this.reconnect()
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
