import { PrismaClient } from '@prisma/client'

// PrismaClient 是附加到 `global` 对象的，以防止在开发过程中
// 热重载时创建多个实例
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 