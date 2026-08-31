/**
 * RBAC 工具模块（前端）
 *
 * 镜像 server/utils/rbac/constants.ts 的权限 key 与角色枚举，
 * 为 useRbac composable 与组件级 can() 检查提供单一权威入口。
 *
 * 数据来源：
 *   - useRbac 启动时调 /api/admin/rbac/my-permissions 拉取用户有效权限
 *   - 缓存到 Pinia-like 内存模块（避免 SSR 跨请求泄漏，见 useRbac 实现）
 *   - 组件内 const rbac = useRbac(); rbac.can('user.manage') 同步判断
 */

export const ROLES = {
  USER: 'USER',
  SONG_ADMIN: 'SONG_ADMIN',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

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

// 后端可能回传冒号风格旧值；归一化为点分风格
const LEGACY_PERMISSION_MAP: Record<string, PermissionKey> = {
  'schedules:read': PERMISSIONS.SCHEDULE_READ,
  'songs:read': PERMISSIONS.SONG_READ,
  'songs:request': PERMISSIONS.SONG_READ,
  'songs:write': PERMISSIONS.SONG_WRITE,
  'card-codes:read': PERMISSIONS.CARD_CODES_READ,
  'card-codes:write': PERMISSIONS.CARD_CODES_WRITE,
  'card-codes:delete': PERMISSIONS.CARD_CODES_DELETE,
  'backup:execute': PERMISSIONS.BACKUP_EXECUTE
}

export function normalizePermission(raw: string): PermissionKey | null {
  const mapped = LEGACY_PERMISSION_MAP[raw] ?? raw
  return typeof mapped === 'string' && mapped.includes('.') ? (mapped as PermissionKey) : null
}

// 路由 → 权限 映射（与 server/utils/rbac/routePermissionMap 对齐）
// 用于 useRbac.canAccessPage() 把 sidebar 的 page id 转成 permission key
export const PAGE_PERMISSIONS: Record<string, PermissionKey> = {
  overview: PERMISSIONS.STATS_READ,
  schedule: PERMISSIONS.SCHEDULE_WRITE,
  print: PERMISSIONS.SCHEDULE_WRITE,
  songs: PERMISSIONS.SONG_WRITE,
  users: PERMISSIONS.USER_MANAGE,
  'grade-class': PERMISSIONS.GRADE_CLASS_MANAGE,
  notifications: PERMISSIONS.NOTIFICATION_SEND,
  'smtp-config': PERMISSIONS.SMTP_MANAGE,
  playtimes: PERMISSIONS.PLAYTIMES_MANAGE,
  'request-times': PERMISSIONS.REQUEST_TIMES_MANAGE,
  semesters: PERMISSIONS.SEMESTER_MANAGE,
  blacklist: PERMISSIONS.BLACKLIST_MANAGE,
  'site-config': PERMISSIONS.SYSTEM_SETTINGS_WRITE,
  database: PERMISSIONS.DATABASE_RESET,
  'api-keys': PERMISSIONS.API_KEYS_READ,
  'data-analysis': PERMISSIONS.STATS_READ,
  'music-source': PERMISSIONS.SYSTEM_SETTINGS_WRITE,
  'rbac': PERMISSIONS.PERMISSIONS_READ,
  'card-codes': PERMISSIONS.CARD_CODES_READ
}

export function getPagePermission(pageId: string): PermissionKey | null {
  return PAGE_PERMISSIONS[pageId] ?? null
}
