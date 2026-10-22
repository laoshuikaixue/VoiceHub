import { defineEventHandler } from 'h3'
import { cleanupOldHistory } from '~~/server/services/autoBackupService'
import { canExecuteBackup } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：backup.execute（SUPER_ADMIN）；未登录 401 / 账号异常 403 / 缺权限 403
  await canExecuteBackup(event)

  const count = await cleanupOldHistory(0) // 0 = 清理全部
  return { success: true, message: `已清理 ${count} 条备份历史记录`, data: { count } }
})