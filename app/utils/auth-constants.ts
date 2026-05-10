/**
 * 认证相关的共享常量。
 * 集中维护角色枚举与管理员角色集合，避免在多个文件中重复硬编码字符串数组。
 */

/**
 * 拥有管理员权限的角色集合（包括超级管理员、普通管理员、歌曲管理员）。
 * 当用户的 role 命中该列表时即视为 isAdmin。
 *
 * 使用 `as const` 锁定字面量类型，便于派生 `AdminRole` 类型。
 */
export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

/**
 * 判断给定角色是否属于管理员角色。
 * @param role 用户角色字符串（可为 undefined / null）
 */
export const isAdminRole = (role: string | null | undefined): boolean => {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}
