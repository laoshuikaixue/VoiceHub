import { defineEventHandler } from 'h3'
import { createError } from 'h3'
import { cleanupOldHistory } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '只有超级管理员可以清理备份历史' })
  }

  const count = await cleanupOldHistory(0) // 0 = 清理全部
  return { success: true, message: `已清理 ${count} 条备份历史记录`, data: { count } }
})