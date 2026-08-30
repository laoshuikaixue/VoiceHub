/**
 * RBAC 模块常量与权限 key 枚举
 * 权威定义：与 app/drizzle/schema.ts 的 permissions.key 完全对齐
 */

export const ROLES = {
  USER: 'USER',
  SONG_ADMIN: 'SONG_ADMIN',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// 权限 key 与 permissions 表对齐；类型用于静态检查
export const PERMISSIONS = {
  USER_READ: 'user.read',
  USER_MANAGE: 'user.manage',
  USER_STATUS: 'user.status',
  SONG_READ: 'song.read',
  SONG_WRITE: 'song.write',
  SONG_REJECT: 'song.reject',
  SCHEDULE_READ: 'schedule.read',
  SCHEDULE_WRITE: 'schedule.write',
  SCHEDULE_PUBLISH: 'schedule.publish',
  PLAYTIMES_MANAGE: 'playtimes.manage',
  REQUEST_TIMES_MANAGE: 'request_times.manage',
  SEMESTER_MANAGE: 'semester.manage',
  STATS_READ: 'stats.read',
  CARD_CODES_READ: 'card_codes.read',
  CARD_CODES_WRITE: 'card_codes.write',
  CARD_CODES_DELETE: 'card_codes.delete',
  BLACKLIST_MANAGE: 'blacklist.manage',
  SYSTEM_SETTINGS_READ: 'system_settings.read',
  SYSTEM_SETTINGS_WRITE: 'system_settings.write',
  EMAIL_TEMPLATES_MANAGE: 'email_templates.manage',
  SMTP_MANAGE: 'smtp.manage',
  GRADE_CLASS_MANAGE: 'grade_class.manage',
  BACKUP_EXECUTE: 'backup.execute',
  BACKUP_EXPORT: 'backup.export',
  BACKUP_RESTORE: 'backup.restore',
  DATABASE_RESET: 'database.reset',
  NOTIFICATION_SEND: 'notification.send',
  API_KEYS_READ: 'api_keys.read',
  API_KEYS_WRITE: 'api_keys.write',
  API_KEYS_DELETE: 'api_keys.delete',
  API_KEYS_MANAGE: 'api_keys.manage',
  ROLE_MANAGE: 'role.manage',
  USER_PERMISSIONS_MANAGE: 'user_permissions.manage',
  PERMISSIONS_READ: 'permissions.read',
  PERMISSIONS_MANAGE: 'permissions.manage'
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// 旧冒号风格 → 新点分风格（兼容读取期）
export const LEGACY_PERMISSION_MAP: Record<string, PermissionKey> = {
  'schedules:read': PERMISSIONS.SCHEDULE_READ,
  'songs:read': PERMISSIONS.SONG_READ,
  'songs:request': PERMISSIONS.SONG_READ,
  'songs:write': PERMISSIONS.SONG_WRITE,
  'card-codes:read': PERMISSIONS.CARD_CODES_READ,
  'card-codes:write': PERMISSIONS.CARD_CODES_WRITE,
  'card-codes:delete': PERMISSIONS.CARD_CODES_DELETE,
  'backup:execute': PERMISSIONS.BACKUP_EXECUTE
}

// 个人加授类型
export const GRANT_TYPES = {
  ASSIGN: 'assign',
  REVOKE: 'revoke'
} as const

export type GrantType = (typeof GRANT_TYPES)[keyof typeof GRANT_TYPES]
