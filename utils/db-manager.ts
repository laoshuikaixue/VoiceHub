import { prisma } from '~/prisma/client'

// 数据库连接状态管理
class DatabaseManager {
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000 // 初始重连延迟1秒
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startHealthCheck()
  }

  // 检查数据库连接状态
  async checkConnection(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1 as connection_test`
      this.isConnected = true
      this.reconnectAttempts = 0 // 重置重连计数
      return true
    } catch (error) {
      this.isConnected = false
      console.error('Database connection check failed:', error.message)
      return false
    }
  }

  // 重新连接数据库
  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return false
    }

    this.reconnectAttempts++
    console.log(`Attempting to reconnect to database (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    try {
      // 断开现有连接
      await prisma.$disconnect()
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay))
      
      // 重新连接
      await prisma.$connect()
      
      // 测试连接
      const isConnected = await this.checkConnection()
      
      if (isConnected) {
        console.log('Database reconnection successful')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000 // 重置延迟
        return true
      } else {
        throw new Error('Connection test failed after reconnect')
      }
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error.message)
      
      // 指数退避：增加延迟时间
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000) // 最大30秒
      
      // 如果还有重试机会，继续尝试
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.reconnect(), this.reconnectDelay)
      }
      
      return false
    }
  }

  // 启动健康检查
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      const isConnected = await this.checkConnection()
      
      if (!isConnected && this.reconnectAttempts === 0) {
        console.log('Health check detected disconnection, starting reconnection process')
        this.reconnect()
      }
    }, 30000) // 每30秒检查一次
  }

  // 停止健康检查
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  // 执行数据库操作，带有自动重连
  async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        const isConnectionError = error.message.includes('ECONNRESET') ||
                                error.message.includes('ENOTFOUND') ||
                                error.message.includes('ETIMEDOUT') ||
                                error.message.includes('Connection terminated') ||
                                error.message.includes('Connection lost')

        if (isConnectionError && attempt < maxRetries) {
          console.log(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying...`)
          
          // 尝试重新连接
          await this.reconnect()
          
          // 等待一小段时间再重试
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          throw error
        }
      }
    }
    
    throw new Error('All retry attempts failed')
  }

  // 获取连接状态
  getConnectionStatus(): boolean {
    return this.isConnected
  }

  // 获取重连尝试次数
  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }
}

// 创建全局数据库管理器实例
export const dbManager = new DatabaseManager()

// 导出便捷函数
export async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  return dbManager.executeWithRetry(operation)
}

export function getDbStatus() {
  return {
    connected: dbManager.getConnectionStatus(),
    reconnectAttempts: dbManager.getReconnectAttempts()
  }
}
