import { prisma } from '../../prisma/client'

// 添加数据库连接状态检查函数
export async function checkDatabaseConnection() {
  try {
    // 执行一个简单的查询来测试数据库连接
    const count = await prisma.$queryRaw`SELECT 1 as result`
    console.log('Database connection test successful:', count)
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

// 尝试重新连接数据库
export async function reconnectDatabase() {
  try {
    await prisma.$disconnect()
    console.log('Disconnected from database')
    
    await prisma.$connect()
    console.log('Reconnected to database')
    
    return true
  } catch (error) {
    console.error('Failed to reconnect to database:', error)
    return false
  }
}

// 数据库模型在prisma/schema.prisma中定义
export { prisma } 