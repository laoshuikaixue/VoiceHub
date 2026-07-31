import { defineEventHandler } from 'h3'
import { executeAutoBackup } from '~~/server/services/autoBackupService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  try {
    const result = await executeAutoBackup()
    return { success: true, data: result }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createApiError(500, SERVER_ERROR_CODES.BACKUP_FAILED, error.message || '备份执行失败')
  }
})