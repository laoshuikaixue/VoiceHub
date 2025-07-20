import { prisma } from '~/prisma/client'

// 数据库连接池管理器
class DatabasePool {
  private isConnected = false
  private lastHealthCheck = 0
  private healthCheckInterval = 30000 // 30秒
  private connectionAttempts = 0
  private maxConnectionAttempts = 5
  private reconnectDelay = 1000

  constructor() {
    this.initialize()
  }

  // 初始化连接池
  async initialize() {
    try {
      await this.ensureConnection()
      this.startPeriodicHealthCheck()
      console.log('[DB Pool] 数据库连接池初始化成功')
    } catch (error) {
      console.error('[DB Pool] 初始化失败:', error)
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
    } catch (error) {
      console.error('[DB Pool] 连接检查失败:', error.message)
      this.isConnected = false
      
      // 尝试重新连接
      return await this.reconnect()
    }
  }

  // 重新连接数据库
  async reconnect(): Promise<boolean> {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.error('[DB Pool] 达到最大重连次数')
      return false
    }

    this.connectionAttempts++
    console.log(`[DB Pool] 尝试重连 (${this.connectionAttempts}/${this.maxConnectionAttempts})`)

    try {
      // 断开现有连接
      await prisma.$disconnect()
      
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
    } catch (error) {
      console.error(`[DB Pool] 重连失败 (尝试 ${this.connectionAttempts}):`, error.message)
      
      // 增加延迟时间
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000)
      
      return false
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
    } catch (error) {
      console.error(`[DB Pool] 操作失败: ${operationName}`, error.message)
      
      // 检查是否是连接错误
      const isConnectionError = error.message.includes('ECONNRESET') ||
                               error.message.includes('ENOTFOUND') ||
                               error.message.includes('ETIMEDOUT') ||
                               error.message.includes('Connection terminated')

      if (isConnectionError) {
        console.log(`[DB Pool] 检测到连接错误，标记连接为不可用`)
        this.isConnected = false
        
        // 尝试重新连接并重试操作
        const reconnected = await this.reconnect()
        if (reconnected) {
          console.log(`[DB Pool] 重连成功，重试操作: ${operationName}`)
          return await operation()
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
