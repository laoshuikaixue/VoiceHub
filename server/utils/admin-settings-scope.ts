import { hasAdminPermission } from '../../app/utils/admin-permissions.ts'

// 各模块配置的读写边界；未列出的字段不得通过模块接口读取或写入。
export const ADMIN_SETTINGS_SCOPES = {
  smtp: {
    read: ['smtp:read'], write: ['smtp:write'],
    fields: ['smtpEnabled', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUsername', 'smtpPassword', 'smtpFromEmail', 'smtpFromName']
  },
  astrbot: {
    read: ['astrbot:read'], write: ['astrbot:write'],
    fields: ['astrbotEnabled', 'astrbotToken', 'astrbotBaseUrl', 'astrbotPushMode', 'astrbotBroadcastEnabled', 'astrbotGroupTargets', 'astrbotPlatforms', 'astrbotWeeklyConfig', 'astrbotGroupEvents', 'astrbotGroupThrottle']
  },
  'play-times': {
    read: ['play-times:read', 'system-settings:read'], write: ['play-times:write', 'system-settings:write'],
    fields: ['enablePlayTimeSelection', 'playSlotRequired']
  },
  'request-times': {
    read: ['request-times:read', 'system-settings:read'], write: ['request-times:write', 'system-settings:write'],
    fields: ['enableRequestTimeLimitation', 'forceBlockAllRequests', 'enableSubmissionRestriction', 'submissionRestrictionScope', 'sameSongRestrictionHours', 'sameArtistRestrictionHours']
  },
  'music-source': {
    read: ['music-source:read', 'system-settings:read'], write: ['music-source:write', 'system-settings:write'],
    fields: ['enabledPlatforms', 'platformOrder']
  },
  // 日志管理：API 访问日志级别与数据库日志保留天数
  logging: {
    read: ['logs:read'], write: ['logs:manage'],
    fields: ['apiLogLevel', 'apiLogRetentionDays', 'auditLogRetentionDays']
  }
} as const

export type AdminSettingsScope = keyof typeof ADMIN_SETTINGS_SCOPES

export function isAdminSettingsScope(scope: unknown): scope is AdminSettingsScope {
  return typeof scope === 'string' && Object.hasOwn(ADMIN_SETTINGS_SCOPES, scope)
}

export function canAccessSettingsScope(user: { perms?: readonly string[] } | null | undefined, scope: AdminSettingsScope, write = false): boolean {
  return ADMIN_SETTINGS_SCOPES[scope][write ? 'write' : 'read'].some((code) => hasAdminPermission(user, code))
}

export function invalidScopeFields(scope: AdminSettingsScope, payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['body']
  const fields: readonly string[] = ADMIN_SETTINGS_SCOPES[scope].fields
  return Object.keys(payload).filter((field) => !fields.includes(field))
}

export function pickScopeSettings(scope: AdminSettingsScope, settings: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(ADMIN_SETTINGS_SCOPES[scope].fields
    .filter((field) => Object.hasOwn(settings, field))
    .map((field) => [field, settings[field]]))
}
