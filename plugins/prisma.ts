import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// 只在服务端创建 PrismaClient 实例
const prisma = process.server 
  ? global.prisma || new PrismaClient()
  : undefined

// 开发环境下保存到全局变量以避免热重载时创建多个实例
if (process.server && process.env.NODE_ENV === 'development') {
  global.prisma = prisma
}

export default defineNuxtPlugin(() => {
  return {
    provide: {
      prisma
    }
  }
}) 