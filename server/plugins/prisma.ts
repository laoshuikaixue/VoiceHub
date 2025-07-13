import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

declare module 'h3' {
  interface H3EventContext {
    prisma: PrismaClient
  }
}

export default defineNitroPlugin((nitroApp) => {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  
  nitroApp.hooks.hook('request', (event) => {
    event.context.prisma = prisma
  })
}) 