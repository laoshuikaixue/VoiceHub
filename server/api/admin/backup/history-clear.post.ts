import { defineEventHandler } from 'h3'
import { cleanupOldHistory } from '~~/server/services/autoBackupService'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  const count = await cleanupOldHistory(0) // 0 = 清理全部

  await recordAdminAudit(event, 'backup.history-clear', {
    targetType: 'backup',
    summary: { cleared: count }
  })

  return { success: true, message: `已清理 ${count} 条备份历史记录`, data: { count } }
})
