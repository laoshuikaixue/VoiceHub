import { defineEventHandler } from 'h3'
import { prepareBackup, executeUploads } from '~~/server/services/autoBackupService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  try {
    const prepared = await prepareBackup()

    // 后台执行上传，不阻塞响应
    executeUploads(prepared).catch(err => console.error('后台备份失败:', err))

    return {
      success: true,
      message: '备份任务已触发',
      backupId: prepared.historyId
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createApiError(500, SERVER_ERROR_CODES.BACKUP_FAILED, error.message || '备份执行失败')
  }
})