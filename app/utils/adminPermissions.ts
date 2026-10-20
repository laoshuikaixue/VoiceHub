export const ADMIN_PERMISSION_CODES = [
  'songs:read',
  'songs:review',
  'songs:pool',
  'songs:meta',
  'schedule:write',
  'play-times:write',
  'request-times:write',
  'semester:write',
  'card-codes:write',
  'user:manage'
] as const

export type AdminPermissionCode = (typeof ADMIN_PERMISSION_CODES)[number]

// 后台准入角色（含歌曲管理员）
export const ADMIN_ACCESS_ROLES: readonly string[] = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']
// 管理员及以上档位
export const SYSTEM_ADMIN_ROLES: readonly string[] = ['ADMIN', 'SUPER_ADMIN']
export const SUPER_ADMIN_ROLES: readonly string[] = ['SUPER_ADMIN']

export const ROLE_PERMISSION_CODES: Record<string, ReadonlyArray<AdminPermissionCode>> = {
  USER: [],
  SONG_ADMIN: ['songs:read', 'songs:review', 'songs:pool', 'songs:meta', 'card-codes:write'],
  ADMIN: [...ADMIN_PERMISSION_CODES],
  SUPER_ADMIN: [...ADMIN_PERMISSION_CODES]
}

// 超级管理员可单独授予某个歌曲管理员的权限档位（角色默认已含的档位不在此列）
export const SONG_ADMIN_GRANTABLE_PERMISSION_CODES = [
  'schedule:write',
  'play-times:write',
  'request-times:write',
  'semester:write'
] as const satisfies ReadonlyArray<AdminPermissionCode>

// 管理员及以上档位，不随用户授权变化
export const SYSTEM_ADMIN_PERMISSION_CODES = [
  'user:manage'
] as const satisfies ReadonlyArray<AdminPermissionCode>

// 相对角色默认的额外授权，仅歌曲管理员使用
export const ROLE_CONFIGURABLE_PERMISSION_ROLES = ['SONG_ADMIN'] as const

export function isConfigurablePermissionRole(role: unknown): boolean {
  return (ROLE_CONFIGURABLE_PERMISSION_ROLES as readonly unknown[]).includes(role)
}

export function isAdminPermissionCode(value: unknown): value is AdminPermissionCode {
  return typeof value === 'string' && (ADMIN_PERMISSION_CODES as readonly string[]).includes(value)
}

export function isGrantablePermissionCode(
  value: unknown
): value is (typeof SONG_ADMIN_GRANTABLE_PERMISSION_CODES)[number] {
  return (
    typeof value === 'string' &&
    (SONG_ADMIN_GRANTABLE_PERMISSION_CODES as readonly string[]).includes(value)
  )
}

// 写入前剔除角色默认已包含项与非法值，只保留可授予档位的额外授权
export function normalizePermissionCodes(
  value: unknown,
  user: { role?: unknown } | null | undefined
): string[] {
  const role = String(user?.role ?? '')
  if (!isConfigurablePermissionRole(role)) {
    return []
  }
  const base = new Set<string>(ROLE_PERMISSION_CODES[role] || [])
  const seen = new Set<string>()
  for (const item of Array.isArray(value) ? value : []) {
    if (isGrantablePermissionCode(item) && !base.has(item)) seen.add(item)
  }
  return [...seen]
}

export function resolveEffectivePermissions(
  user: { role?: unknown; permissions?: unknown } | null | undefined
): AdminPermissionCode[] {
  if (!user) return []
  const role = String(user?.role ?? '')
  const base = ROLE_PERMISSION_CODES[role] ?? []
  const merged = new Set<AdminPermissionCode>(base)
  if (isConfigurablePermissionRole(role)) {
    for (const code of Array.isArray(user.permissions) ? user.permissions : []) {
      if (isGrantablePermissionCode(code)) merged.add(code)
    }
  }
  return [...merged]
}
