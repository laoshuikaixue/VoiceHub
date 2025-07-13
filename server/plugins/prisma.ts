import { prisma } from '../models/schema'
import { PrismaClient } from '@prisma/client'

declare module 'h3' {
  interface H3EventContext {
    prisma: PrismaClient
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context.prisma = prisma
  })
}) 