import { defineEventHandler } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig, isAutoBackupEnabled } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以查看自动备份配置')
  }

  const enabled = await isAutoBackupEnabled()
  const config = await getAutoBackupConfig()

  return {
    success: true,
    data: {
      enabled,
      config: config ? sanitizeConfig(config) : null
    }
  }
})

/** 移除敏感信息后返回 */
function sanitizeConfig(config: any) {
  const sanitized = JSON.parse(JSON.stringify(config))
  // 隐藏密钥
  if (sanitized.methods?.s3) {
    sanitized.methods.s3.secretKey = sanitized.methods.s3.secretKey ? '****' : ''
  }
  if (sanitized.methods?.webdav) {
    sanitized.methods.webdav.password = sanitized.methods.webdav.password ? '****' : ''
  }
  if (sanitized.methods?.telegram) {
    sanitized.methods.telegram.botToken = sanitized.methods.telegram.botToken ? '****' : ''
  }
  return sanitized
}