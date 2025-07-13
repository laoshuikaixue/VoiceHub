import { PrismaClient } from '@prisma/client'

// 避免在开发环境中创建多个 Prisma 实例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 数据库模型在prisma/schema.prisma中定义 