import { db } from '~/drizzle/db'

export default defineNitroPlugin(async (nitroApp) => {
  // 全局未处理的Promise拒绝处理器
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    
    // 检查是否是数据库连接错误
    if (reason && typeof reason === 'object' && 'message' in reason) {
      const errorMessage = (reason as Error).message
      
      if (errorMessage.includes('ECONNRESET') || 
          errorMessage.includes('ENOTFOUND') || 
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('Connection terminated') ||
          errorMessage.includes('Connection lost')) {
        
        console.log('Database connection error detected, attempting to reconnect...')
        
        try {
          // 尝试重新连接数据库
          await prisma.$disconnect()
          await new Promise(resolve => setTimeout(resolve, 2000)) // 等待2秒
          await prisma.$connect()
          console.log('Database reconnection successful')
        } catch (reconnectError) {
          console.error('Database reconnection failed:', reconnectError)
          
          // 如果重连失败，等待更长时间后再次尝试
          setTimeout(async () => {
            try {
              await prisma.$disconnect()
              await new Promise(resolve => setTimeout(resolve, 5000)) // 等待5秒
              await prisma.$connect()
              console.log('Database delayed reconnection successful')
            } catch (delayedReconnectError) {
              console.error('Database delayed reconnection failed:', delayedReconnectError)
            }
          }, 10000) // 10秒后重试
        }
      }
    }
    
    // 不要让进程退出，继续运行
    console.log('Process will continue running despite the error')
  })

  // 全局未捕获异常处理器
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    
    // 检查是否是数据库相关错误
    if (error.message.includes('ECONNRESET') || 
        error.message.includes('ENOTFOUND') || 
        error.message.includes('ETIMEDOUT')) {
      console.log('Database-related uncaught exception, process will continue')
      return // 不退出进程
    }
    
    // 对于其他严重错误，记录但不退出
    console.error('Non-database uncaught exception, process will continue')
  })

  // 定期健康检查
  const healthCheckInterval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 as health_check`
    } catch (error) {
      console.error('Health check failed:', error)
      
      // 尝试重新连接
      try {
        await prisma.$disconnect()
        await new Promise(resolve => setTimeout(resolve, 1000))
        await prisma.$connect()
        console.log('Health check reconnection successful')
      } catch (reconnectError) {
        console.error('Health check reconnection failed:', reconnectError)
      }
    }
  }, 60000) // 每分钟检查一次

  // 在Nitro关闭时清理
  nitroApp.hooks.hook('close', () => {
    clearInterval(healthCheckInterval)
  })

  // 数据库连接错误的特殊处理
  const originalQuery = prisma.$queryRaw
  prisma.$queryRaw = new Proxy(originalQuery, {
    apply: async (target, thisArg, argumentsList) => {
      try {
        return await target.apply(thisArg, argumentsList)
      } catch (error) {
        if (error.message.includes('ECONNRESET') || 
            error.message.includes('Connection terminated')) {
          console.log('Query failed due to connection reset, attempting to reconnect and retry...')
          
          try {
            await prisma.$disconnect()
            await new Promise(resolve => setTimeout(resolve, 1000))
            await prisma.$connect()
            
            // 重试查询
            return await target.apply(thisArg, argumentsList)
          } catch (retryError) {
            console.error('Query retry failed:', retryError)
            throw retryError
          }
        }
        throw error
      }
    }
  })

  console.log('Global error handler initialized')
})
