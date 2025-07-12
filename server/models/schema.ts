import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
 
// 数据库模型在prisma/schema.prisma中定义 