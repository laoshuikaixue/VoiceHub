/**
 * 认证相关的共享常量。
 * 服务端和客户端代码均从此文件导入，确保角色定义的单一来源。
 */

export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

/**
 * 判断给定角色是否属于管理员角色。
 */
export const isAdminRole = (role: string | null | undefined): boolean => {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}
