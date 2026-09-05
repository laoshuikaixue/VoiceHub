import { defineEventHandler } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { cleanupOldHistory } from '~~/server/services/autoBackupService'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const count = await cleanupOldHistory(0) // 0 = 清理全部
  return { success: true, message: `已清理 ${count} 条备份历史记录`, data: { count } }
})