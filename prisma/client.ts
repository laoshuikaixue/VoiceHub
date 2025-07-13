import { PrismaClient } from '@prisma/client'

// PrismaClient 是附加到 `global` 对象的，以防止在开发过程中
// 热重载时创建多个实例
const globalForPrisma = global as unknown as { prisma: PrismaClient }

// 检查数据库连接字符串是否已设置
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set')
}

// 创建 Prisma 客户端实例
export const prisma = globalForPrisma.prisma || 
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    errorFormat: 'pretty',
  })

// 测试数据库连接
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to the database')
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error)
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 