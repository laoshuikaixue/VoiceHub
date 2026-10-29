export const SMTP_PASSWORD_MASK = '****************'
export const SECRET_FIELD_MASK = '••••••••••••••••'

const SECRET_FIELDS = [
  ['smtpPassword', SMTP_PASSWORD_MASK],
  ['astrbotToken', SECRET_FIELD_MASK],
  ['oauthStateSecret', SECRET_FIELD_MASK],
  ['githubClientSecret', SECRET_FIELD_MASK],
  ['casdoorClientSecret', SECRET_FIELD_MASK],
  ['googleClientSecret', SECRET_FIELD_MASK],
  ['aggregateOAuthAppKey', SECRET_FIELD_MASK],
  ['customOAuthClientSecret', SECRET_FIELD_MASK],
  ['turnstileSecretKey', SECRET_FIELD_MASK]
]

export const maskSystemSettingsSecrets = <T extends Record<string, any>>(settings: T): T => {
  if (!settings) return settings

  const masked: Record<string, any> = {
    ...settings,
    smtpPassword: settings.smtpPassword ? SMTP_PASSWORD_MASK : settings.smtpPassword,
    astrbotToken: settings.astrbotToken ? SECRET_FIELD_MASK : settings.astrbotToken,
    oauthStateSecret: settings.oauthStateSecret ? SECRET_FIELD_MASK : settings.oauthStateSecret,
    githubClientSecret: settings.githubClientSecret ? SECRET_FIELD_MASK : settings.githubClientSecret,
    casdoorClientSecret: settings.casdoorClientSecret ? SECRET_FIELD_MASK : settings.casdoorClientSecret,
    googleClientSecret: settings.googleClientSecret ? SECRET_FIELD_MASK : settings.googleClientSecret,
    aggregateOAuthAppKey: settings.aggregateOAuthAppKey ? SECRET_FIELD_MASK : settings.aggregateOAuthAppKey,
    customOAuthClientSecret: settings.customOAuthClientSecret
      ? SECRET_FIELD_MASK
      : settings.customOAuthClientSecret,
    turnstileSecretKey: settings.turnstileSecretKey ? SECRET_FIELD_MASK : settings.turnstileSecretKey
  }
  // 备份目的地的 S3 secretKey / WebDAV password / Telegram botToken 整段存在 autoBackupConfig 里，
  // 无法逐字段掩码；去敏后的配置由专用接口 backup/auto-config.get 按超级管理员返回
  delete masked.autoBackupConfig

  return masked as T
}

/** 从脱敏备份中移除掩码字段，避免把掩码写成真实密钥。 */
export const omitMaskedSystemSettingsSecrets = <T extends Record<string, any>>(settings: T): T => {
  if (!settings) return settings

  const maskedPairs = new Set(SECRET_FIELDS.map(([field, mask]) => `${field}\u0000${mask}`))
  const kept = Object.entries(settings).filter(
    ([field, value]) => !maskedPairs.has(`${field}\u0000${value}`)
  )
  return Object.fromEntries(kept) as T
}
