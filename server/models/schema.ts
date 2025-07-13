import { PrismaClient } from '@prisma/client'

// 为了避免循环引用，我们直接从@prisma/client导入PrismaClient
// 并在这里创建一个实例，而不是从prisma/client.ts导入
const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty'
})

// 添加数据库连接状态检查函数
export async function checkDatabaseConnection() {
  try {
    // 执行一个简单的查询来测试数据库连接
    const startTime = Date.now()
    console.log('Testing database connection...')
    
    // 设置超时，防止查询挂起
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection test timed out after 5000ms')), 5000)
    })
    
    // 实际的查询
    const queryPromise = prisma.$queryRaw`SELECT 1 as result`
    
    // 使用Promise.race来实现超时
    const result = await Promise.race([queryPromise, timeoutPromise])
    
    const duration = Date.now() - startTime
    console.log(`Database connection test successful in ${duration}ms:`, result)
    
    return true
  } catch (error) {
    // 详细记录错误信息
    if (error instanceof Error) {
      console.error('Database connection test failed:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      
      // 检查特定类型的错误
      if (error.message.includes('timeout')) {
        console.error('Connection test timed out - database server might be overloaded or network issues')
      } else if (error.message.includes('connect')) {
        console.error('Connection refused - check if database server is running and accessible')
      }
    } else {
      console.error('Database connection test failed with unknown error type:', error)
    }
    
    return false
  }
}

// 尝试重新连接数据库
export async function reconnectDatabase() {
  try {
    console.log('Attempting to disconnect from database...')
    await prisma.$disconnect()
    console.log('Disconnected from database')
    
    // 短暂延迟，确保完全断开连接
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('Attempting to reconnect to database...')
    const startTime = Date.now()
    
    // 设置连接超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database reconnection timed out after 10000ms')), 10000)
    })
    
    // 实际的连接尝试
    const connectPromise = prisma.$connect()
    
    // 使用Promise.race来实现超时
    await Promise.race([connectPromise, timeoutPromise])
    
    const duration = Date.now() - startTime
    console.log(`Reconnected to database in ${duration}ms`)
    
    // 验证连接是否真的成功
    const isConnected = await checkDatabaseConnection()
    if (!isConnected) {
      throw new Error('Reconnection appeared successful but connection test failed')
    }
    
    return true
  } catch (error) {
    // 详细记录错误信息
    if (error instanceof Error) {
      console.error('Failed to reconnect to database:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      
      // 检查特定类型的错误
      if (error.message.includes('timeout')) {
        console.error('Reconnection timed out - database server might be overloaded or network issues')
      } else if (error.message.includes('connect')) {
        console.error('Reconnection refused - check if database server is running and accessible')
      }
    } else {
      console.error('Failed to reconnect to database with unknown error type:', error)
    }
    
    return false
  }
}
 
// 数据库模型在prisma/schema.prisma中定义 
export { prisma } 