import { defineEventHandler } from 'h3'
import { createError } from 'h3'
import { getBackupHistory } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '只有超级管理员可以查看备份历史' })
  }

  const history = await getBackupHistory()
  return { success: true, data: history }
})