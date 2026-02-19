import type { RedisClientOptions, RedisClientType } from 'redis'
import { createClient } from 'redis'

// Redis连接池管理类
class RedisPool {
  private client: RedisClientType | null = null
  private isConnected = false
  private isConnecting = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // 1秒
  private healthCheckInterval: NodeJS.Timeout | null = null
  private lastHealthCheck = 0
  private connectionStats = {
    totalConnections: 0,
    failedConnections: 0,
    lastConnectedAt: null as Date | null,
    lastFailedAt: null as Date | null
  }

  // Redis配置
  private config: RedisClientOptions = {
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 10000, // 10秒连接超时
      lazyConnect: true, // 延迟连接
      reconnectStrategy: (retries) => {
        if (retries >= this.maxReconnectAttempts) {
          console.error('[Redis] 达到最大重连次数，停止重连')
          return false
        }
        const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000)
        console.log(`[Redis] 第${retries + 1}次重连，延迟${delay}ms`)
        return delay
      }
    },
    // 启用离线队列，在断线时缓存命令
    enableOfflineQueue: false,
    // 确保使用UTF-8编码
    encoding: 'utf8'
  }

  constructor() {
    // 检查是否启用Redis
    if (!this.isRedisEnabled()) {
      console.log('[Redis] Redis未配置或已禁用，将使用数据库直接查询')
      return
    }

    this.initializeClient()
  }

  // 连接到Redis
  async connect(): Promise<boolean> {
    if (!this.isRedisEnabled() || !this.client) {
      return false
    }

    if (this.isConnected) {
      return true
    }

    if (this.isConnecting) {
      // 等待连接完成
      return new Promise((resolve) => {
        const checkConnection = () => {
          if (this.isConnected) {
            resolve(true)
          } else if (!this.isConnecting) {
            resolve(false)
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        checkConnection()
      })
    }

    try {
      this.isConnecting = true
      await this.client.connect()
      return this.isConnected
    } catch (error) {
      console.error('[Redis] 连接失败:', error)
      this.isConnecting = false
      return false
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        this.stopHealthCheck()
        await this.client.quit()
      } catch (error) {
        console.error('[Redis] 断开连接时出错:', error)
        // 强制断开
        await this.client.disconnect()
      }
    }
    this.isConnected = false
    this.isConnecting = false
  }

  // 获取Redis客户端
  getClient(): RedisClientType | null {
    return this.isConnected ? this.client : null
  }

  // 检查连接状态
  isReady(): boolean {
    return this.isConnected && !!this.client
  }

  // 获取连接统计信息
  getStats() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastHealthCheck: this.lastHealthCheck,
      ...this.connectionStats,
      redisEnabled: this.isRedisEnabled()
    }
  }

  // 执行Redis命令（带错误处理）
  async executeCommand<T>(
    command: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T | null> {
    if (!this.isReady()) {
      if (fallback) {
        console.log('[Redis] Redis不可用，使用fallback')
        return await fallback()
      }
      return null
    }

    try {
      return await command()
    } catch (error) {
      console.error('[Redis] 命令执行失败:', error)
      this.isConnected = false

      if (fallback) {
        console.log('[Redis] 命令失败，使用fallback')
        return await fallback()
      }
      return null
    }
  }

  // 检查Redis是否启用
  private isRedisEnabled(): boolean {
    return !!(process.env.REDIS_URL && process.env.REDIS_URL.trim())
  }

  // 初始化Redis客户端
  private initializeClient() {
    try {
      this.client = createClient(this.config)
      this.setupEventHandlers()
    } catch (error) {
      console.error('[Redis] 初始化客户端失败:', error)
      this.client = null
    }
  }

  // 设置事件处理器
  private setupEventHandlers() {
    if (!this.client) return

    this.client.on('connect', () => {
      console.log('[Redis] 连接建立')
      this.isConnected = true
      this.isConnecting = false
      this.reconnectAttempts = 0
      this.connectionStats.totalConnections++
      this.connectionStats.lastConnectedAt = new Date()
    })

    this.client.on('ready', () => {
      console.log('[Redis] 客户端就绪')
      this.startHealthCheck()
    })

    this.client.on('error', (error) => {
      console.error('[Redis] 连接错误:', error.message)
      this.isConnected = false
      this.connectionStats.failedConnections++
      this.connectionStats.lastFailedAt = new Date()
    })

    this.client.on('end', () => {
      console.log('[Redis] 连接关闭')
      this.isConnected = false
      this.stopHealthCheck()
    })

    this.client.on('reconnecting', () => {
      console.log('[Redis] 正在重连...')
      this.isConnecting = true
      this.reconnectAttempts++
    })
  }

  // 健康检查
  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, 30000) // 每30秒检查一次
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  // 执行健康检查
  private async performHealthCheck(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false
    }

    try {
      const start = Date.now()
      await this.client.ping()
      const responseTime = Date.now() - start
      this.lastHealthCheck = Date.now()

      if (responseTime > 5000) {
        console.warn(`[Redis] 健康检查响应时间较慢: ${responseTime}ms`)
      }

      return true
    } catch (error) {
      console.error('[Redis] 健康检查失败:', error)
      this.isConnected = false
      return false
    }
  }
}

// 创建全局Redis池实例
const redisPool = new RedisPool()

// 导出Redis池和便捷方法
export { redisPool }

// 便捷方法
export const connectRedis = () => redisPool.connect()
export const disconnectRedis = () => redisPool.disconnect()
export const getRedisClient = () => redisPool.getClient()
export const isRedisReady = () => redisPool.isReady()
export const getRedisStats = () => redisPool.getStats()
export const executeRedisCommand = <T>(command: () => Promise<T>, fallback?: () => Promise<T>) =>
  redisPool.executeCommand(command, fallback)

// 在应用启动时自动连接
if (process.env.REDIS_URL) {
  redisPool.connect().then((connected) => {
    if (connected) {
      console.log('[Redis] 自动连接成功')
    } else {
      console.log('[Redis] 自动连接失败，将使用数据库直接查询')
    }
  })
}

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('[Redis] 收到SIGINT信号，正在关闭Redis连接...')
  await redisPool.disconnect()
})

process.on('SIGTERM', async () => {
  console.log('[Redis] 收到SIGTERM信号，正在关闭Redis连接...')
  await redisPool.disconnect()
})
