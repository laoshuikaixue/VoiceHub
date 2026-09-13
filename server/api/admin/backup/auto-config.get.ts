import { defineEventHandler } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig, isAutoBackupEnabled } from '~~/server/services/autoBackupService'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

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

/** 移除敏感信息后返回，参考 OAuth 配置的密钥保护模式 */
function sanitizeConfig(config: any) {
  const sanitized = JSON.parse(JSON.stringify(config))
  const configuredSecrets: Record<string, boolean> = {}

  if (sanitized.methods?.s3) {
    configuredSecrets.s3SecretKey = !!sanitized.methods.s3.secretKey
    sanitized.methods.s3.secretKey = ''
  }
  if (sanitized.methods?.webdav) {
    configuredSecrets.webdavPassword = !!sanitized.methods.webdav.password
    sanitized.methods.webdav.password = ''
  }
  if (sanitized.methods?.telegram) {
    configuredSecrets.telegramBotToken = !!sanitized.methods.telegram.botToken
    sanitized.methods.telegram.botToken = ''
  }

  sanitized.configuredSecrets = configuredSecrets
  return sanitized
}