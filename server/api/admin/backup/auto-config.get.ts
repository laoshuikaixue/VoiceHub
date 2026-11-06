import { defineEventHandler } from 'h3'
import { getAutoBackupConfig, isAutoBackupEnabled } from '~~/server/services/autoBackupService'

export default defineEventHandler(async () => {
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
  if (sanitized.methods?.github) {
    configuredSecrets.githubToken = !!sanitized.methods.github.token
    sanitized.methods.github.token = ''
  }
  if (sanitized.methods?.telegram) {
    configuredSecrets.telegramBotToken = !!sanitized.methods.telegram.botToken
    sanitized.methods.telegram.botToken = ''
  }

  sanitized.configuredSecrets = configuredSecrets
  return sanitized
}