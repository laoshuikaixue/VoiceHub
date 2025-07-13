import { PrismaClient } from '@prisma/client'

// PrismaClient 是附加到 `global` 对象的，以防止在开发过程中
// 热重载时创建多个实例
const globalForPrisma = global as unknown as { prisma: PrismaClient }

// 检查数据库连接字符串是否已设置
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set')
} else {
  // 打印数据库连接字符串的安全版本（隐藏敏感信息）
  try {
    const dbUrlObj = new URL(process.env.DATABASE_URL)
    console.log(`Database provider: ${dbUrlObj.protocol}`)
    console.log(`Database host: ${dbUrlObj.hostname}`)
    console.log(`Database has password: ${dbUrlObj.password ? 'Yes' : 'No'}`)
  } catch (error) {
    console.error('Invalid DATABASE_URL format:', error)
  }
}

// 创建 Prisma 客户端实例，添加更多错误处理
let prismaInstance: PrismaClient

try {
  prismaInstance = globalForPrisma.prisma || 
    new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty',
    })
  
  console.log('Prisma client instance created')
} catch (error) {
  console.error('Failed to create Prisma client instance:', error)
  // 创建一个降级的 Prisma 客户端，只记录错误
  prismaInstance = new PrismaClient({
    log: ['error'],
  })
}

// 导出 Prisma 客户端实例
export const prisma = prismaInstance

// 测试数据库连接
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to the database')
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error)
    // 尝试解析更详细的错误信息
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      
      // 检查常见的连接错误
      if (error.message.includes('timeout')) {
        console.error('Connection timeout: Database server might be unreachable or blocked by firewall')
      } else if (error.message.includes('authentication')) {
        console.error('Authentication error: Check username and password in DATABASE_URL')
      } else if (error.message.includes('does not exist')) {
        console.error('Database does not exist: Check database name in DATABASE_URL')
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('Host not found: Check hostname in DATABASE_URL')
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('Connection refused: Database server might be down or not accepting connections')
      }
    }
  })

// 只在非生产环境中缓存 Prisma 客户端实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  console.log('Running in production mode, not caching Prisma client globally')
} 