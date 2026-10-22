import { defineEventHandler } from 'h3'
import { getBackupHistory } from '~~/server/services/autoBackupService'
import { canExecuteBackup } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：backup.execute（SUPER_ADMIN）；未登录 401 / 账号异常 403 / 缺权限 403
  await canExecuteBackup(event)

  const history = await getBackupHistory()
  return { success: true, data: history }
})