/**
 * 前端页面准入纯逻辑（无 Vue / Nuxt 依赖，可被 node:test 直接覆盖）
 *
 * 职责只有两件：pageId → catalog 权限 key 的映射、基于权限集合的准入判定。
 * 权限 key 不在本文件重复定义，一律从后端权威目录 shared/rbac/permission-catalog.js 取，
 * 否则 scripts/contract-checks/single-source.mjs 会把第二份字面量判为违规。
 *
 * 角色矩阵口径：本表推导结果与旧前端硬编码角色白名单逐格一致，
 * 因此每个 pageId 的绑定 key 都取「语义最相符且 minRole 与现状同档」的那一个。
 */

import { PERMISSIONS } from '~~/shared/rbac/permission-catalog.js'

/** pageId 全集（Sidebar 菜单 id ∪ dashboard activeTab），顺序即后台导航顺序 */
export const PAGE_IDS: readonly string[] = Object.freeze([
  'overview',
  'schedule',
  'print',
  'songs',
  'data-analysis',
  'users',
  'grade-class',
  'api-keys',
  'notifications',
  'smtp-config',
  'playtimes',
  'request-times',
  'semesters',
  'blacklist',
  'card-codes',
  'music-source',
  'site-config',
  'database',
  'system-board',
  'password'
])

/** 可作为 dashboard 标签页的 pageId：password 走独立路由，不参与默认页选择 */
export const TAB_PAGE_IDS: readonly string[] = Object.freeze(
  PAGE_IDS.filter((id) => id !== 'password')
)

/**
 * pageId → 权限 key（覆盖全部 pageId，取值必须命中 catalog）。
 * 同一 key 可服务多个 pageId；绑定依据逐项见 planning 记录。
 */
export const PAGE_PERMISSIONS: Readonly<Record<string, string>> = Object.freeze({
  overview: PERMISSIONS.STATS_READ,
  'data-analysis': PERMISSIONS.STATS_READ,
  schedule: PERMISSIONS.SCHEDULE_WRITE,
  print: PERMISSIONS.SCHEDULE_WRITE,
  songs: PERMISSIONS.SONG_WRITE,
  playtimes: PERMISSIONS.PLAYTIMES_MANAGE,
  'request-times': PERMISSIONS.REQUEST_TIMES_MANAGE,
  semesters: PERMISSIONS.SEMESTER_MANAGE,
  'card-codes': PERMISSIONS.CARD_CODES_READ,
  users: PERMISSIONS.USER_MANAGE,
  'grade-class': PERMISSIONS.GRADE_CLASS_MANAGE,
  'music-source': PERMISSIONS.SYSTEM_SETTINGS_READ,
  'api-keys': PERMISSIONS.API_KEYS_READ,
  notifications: PERMISSIONS.SYSTEM_SETTINGS_WRITE,
  'smtp-config': PERMISSIONS.SYSTEM_SETTINGS_WRITE,
  blacklist: PERMISSIONS.SYSTEM_SETTINGS_WRITE,
  'site-config': PERMISSIONS.SYSTEM_SETTINGS_WRITE,
  database: PERMISSIONS.DATABASE_RESET,
  'system-board': PERMISSIONS.DATABASE_RESET,
  password: PERMISSIONS.USER_PERMISSIONS_MANAGE
})

/** 权限 key 集合（调用方传入 Set / ReadonlySet 皆可） */
export type PermissionSet = ReadonlySet<string>

/** 取 pageId 绑定的权限 key；未登记返回 null（不 fail-open） */
export function getPagePermission(pageId: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(PAGE_PERMISSIONS, pageId)) return null
  return PAGE_PERMISSIONS[pageId] ?? null
}

/**
 * 页面准入判定。
 * superAdmin 恒真（与后端超管语义一致，也避免漏配把超管锁在后台外）；
 * 未登记的 pageId 对普通角色一律拒绝。
 */
export function canAccessPage(
  permissionSet: PermissionSet | null | undefined,
  pageId: string,
  superAdmin = false
): boolean {
  if (superAdmin) return true
  const key = getPagePermission(pageId)
  if (!key) return false
  return permissionSet ? permissionSet.has(key) : false
}

/** 可访问的标签页列表（顺序即后台导航顺序） */
export function getUserPages(
  permissionSet: PermissionSet | null | undefined,
  superAdmin = false
): string[] {
  return TAB_PAGE_IDS.filter((id) => canAccessPage(permissionSet, id, superAdmin))
}

/** 是否可进入后台：超管恒真，其余以「至少有一个可访问标签页」为准 */
export function canAccessAdmin(
  permissionSet: PermissionSet | null | undefined,
  superAdmin = false
): boolean {
  if (superAdmin) return true
  return getUserPages(permissionSet, superAdmin).length > 0
}
