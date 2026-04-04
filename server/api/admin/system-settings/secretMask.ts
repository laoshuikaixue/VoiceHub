export const SMTP_PASSWORD_MASK = '****************'
export const SECRET_FIELD_MASK = '••••••••••••••••'

export const maskSystemSettingsSecrets = <T extends Record<string, any>>(settings: T): T => {
  if (!settings) return settings

  return {
    ...settings,
    smtpPassword: settings.smtpPassword ? SMTP_PASSWORD_MASK : settings.smtpPassword,
    oauthStateSecret: settings.oauthStateSecret ? SECRET_FIELD_MASK : settings.oauthStateSecret,
    githubClientSecret: settings.githubClientSecret ? SECRET_FIELD_MASK : settings.githubClientSecret,
    casdoorClientSecret: settings.casdoorClientSecret ? SECRET_FIELD_MASK : settings.casdoorClientSecret,
    googleClientSecret: settings.googleClientSecret ? SECRET_FIELD_MASK : settings.googleClientSecret,
    customOAuthClientSecret: settings.customOAuthClientSecret
      ? SECRET_FIELD_MASK
      : settings.customOAuthClientSecret
  }
}
