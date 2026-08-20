export const SMTP_PASSWORD_MASK = '****************'
export const SECRET_FIELD_MASK = '••••••••••••••••'

const SECRET_FIELDS = [
  ['smtpPassword', SMTP_PASSWORD_MASK],
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

  return {
    ...settings,
    smtpPassword: settings.smtpPassword ? SMTP_PASSWORD_MASK : settings.smtpPassword,
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
}

/** 从脱敏备份中移除掩码字段，避免把掩码写成真实密钥。 */
export const omitMaskedSystemSettingsSecrets = <T extends Record<string, any>>(settings: T): T => {
  if (!settings) return settings

  const result = { ...settings }
  for (const [field, mask] of SECRET_FIELDS) {
    if (result[field] === mask) delete result[field]
  }
  return result
}
