import { defineEventHandler } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { cleanupOldHistory } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以清理备份历史')
  }

  const count = await cleanupOldHistory(0) // 0 = 清理全部
  return { success: true, message: `已清理 ${count} 条备份历史记录`, data: { count } }
})