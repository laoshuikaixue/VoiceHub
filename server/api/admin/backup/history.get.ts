import { defineEventHandler } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getBackupHistory } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以查看备份历史')
  }

  const history = await getBackupHistory()
  return { success: true, data: history }
})