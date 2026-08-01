import { defineEventHandler } from 'h3'
import { prepareBackup, executeUploads, acquireBackupLock, releaseBackupLock } from '~~/server/services/autoBackupService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async () => {
  acquireBackupLock()
  try {
    const prepared = await prepareBackup()
    // 必须等待上传完成再返回响应：
    // Vercel Serverless 在响应返回后会冻结/回收函数实例，
    // 若以 fire-and-forget 后台执行，上传会被中途掐断（socket closed）。
    const result = await executeUploads(prepared)

    return {
      success: result.success,
      message: result.success ? '备份完成' : '备份部分或全部失败',
      backupId: prepared.historyId,
      results: result.results
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createApiError(500, SERVER_ERROR_CODES.BACKUP_FAILED, error.message || '备份执行失败')
  } finally {
    releaseBackupLock()
  }
})