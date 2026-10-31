import { defineEventHandler } from 'h3'
import { cleanupOldHistory } from '~~/server/services/autoBackupService'

export default defineEventHandler(async () => {
  const count = await cleanupOldHistory(0) // 0 = 清理全部
  return { success: true, message: `已清理 ${count} 条备份历史记录`, data: { count } }
})