import { defineEventHandler } from 'h3'
import { executeAutoBackup, isAutoBackupEnabled, getAutoBackupConfig } from '~~/server/services/autoBackupService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  try {
    // 前置校验：确保配置有效再触发后台备份
    const enabled = await isAutoBackupEnabled()
    if (!enabled) {
      throw createApiError(400, SERVER_ERROR_CODES.BACKUP_DISABLED, '自动备份未启用')
    }

    const config = await getAutoBackupConfig()
    if (!config) {
      throw createApiError(400, SERVER_ERROR_CODES.BACKUP_NOT_CONFIGURED, '自动备份未配置')
    }

    const hasEnabledMethod = Object.values(config.methods).some((m: any) => m.enabled)
    if (!hasEnabledMethod) {
      throw createApiError(400, SERVER_ERROR_CODES.NO_BACKUP_METHOD_ENABLED, '没有启用任何备份方式')
    }

    // 后台执行备份，不阻塞响应
    executeAutoBackup().catch(err => console.error('后台备份失败:', err))

    return { success: true, message: '备份任务已触发' }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createApiError(500, SERVER_ERROR_CODES.BACKUP_FAILED, error.message || '备份执行失败')
  }
})