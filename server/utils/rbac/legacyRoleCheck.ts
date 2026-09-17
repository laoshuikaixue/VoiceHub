/**
 * Legacy 角色校验（RBAC_ENABLED=false 时启用）
 *
 * 背景：当 RBAC_ENABLED 关闭（紧急回滚场景），业务接口改用本模块按 4 角色
 * 层级判断权限。映射表必须与 scripts/seed-permissions.js:73-158 的角色矩阵
 * 完全一致——任何漂移都会让回滚语义与原行为产生偏差。
 *
 * 角色层级（包含关系）：
 *   SUPER_ADMIN ⊇ ADMIN ⊇ SONG_ADMIN ⊇ USER
 *
 * 与新 RBAC 路径的差异：
 *   - 新路径：getUserPermissions(userId) 解析 role_permissions ∪ user_permissions
 *   - 本路径：仅按 user.role 字符串判断；忽略个人加授 / 减授
 *
 * 因此本路径等同于"角色权限矩阵 = 个人有效权限"，是 RBAC 重构前的 1:1 等价。
 *
 * ESLint 豁免：本文件必须读 user.role 字面量，已在
 * eslint-rules/no-raw-role-check.js 的允许路径中（rbac 子目录）。
 */

import type { H3Event } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { ROLES, type PermissionKey, type Role } from './constants'

/**
 * 权限点 → 最低所需角色
 *
 * 数据来源：scripts/seed-permissions.js:73-158 ROLE_MATRIX
 * 取每个权限 key 在矩阵中出现的最低角色（即包含该 key 的最弱角色）。
 *
 * USER 角色矩阵为空，因此不在此显式列出——任何 key 都会拒绝 USER。
 *
 * 维护规则：seed-permissions.js 矩阵变更时，本表必须同步；如不同步，
 * RBAC_ENABLED=false 下的回滚语义会与新路径产生偏差。
 */
const LEGACY_MIN_ROLE: Record<PermissionKey, Role> = {
  // SONG_ADMIN 集（点分 key）
  'song.read': ROLES.SONG_ADMIN,
  'song.write': ROLES.SONG_ADMIN,
  'song.reject': ROLES.SONG_ADMIN,
  'schedule.read': ROLES.SONG_ADMIN,
  'schedule.write': ROLES.SONG_ADMIN,
  'schedule.publish': ROLES.SONG_ADMIN,
  'playtimes.manage': ROLES.SONG_ADMIN,
  'request_times.manage': ROLES.SONG_ADMIN,
  'semester.manage': ROLES.SONG_ADMIN,
  'stats.read': ROLES.SONG_ADMIN,
  'card_codes.read': ROLES.SONG_ADMIN,
  'card_codes.write': ROLES.SONG_ADMIN,
  // ADMIN 增量
  'user.read': ROLES.ADMIN,
  'user.manage': ROLES.ADMIN,
  'user.status': ROLES.ADMIN,
  'blacklist.manage': ROLES.ADMIN,
  'system_settings.read': ROLES.ADMIN,
  'email_templates.manage': ROLES.ADMIN,
  'smtp.manage': ROLES.ADMIN,
  'grade_class.manage': ROLES.ADMIN,
  'backup.execute': ROLES.ADMIN,
  'notification.send': ROLES.ADMIN,
  'api_keys.read': ROLES.ADMIN,
  'api_keys.write': ROLES.ADMIN,
  'api_keys.manage': ROLES.ADMIN,
  'permissions.read': ROLES.ADMIN,
  // SUPER_ADMIN 增量
  'role.manage': ROLES.SUPER_ADMIN,
  'user_permissions.manage': ROLES.SUPER_ADMIN,
  'permissions.manage': ROLES.SUPER_ADMIN,
  'system_settings.write': ROLES.SUPER_ADMIN,
  'backup.export': ROLES.SUPER_ADMIN,
  'backup.restore': ROLES.SUPER_ADMIN,
  'database.reset': ROLES.SUPER_ADMIN,
  'card_codes.delete': ROLES.SUPER_ADMIN,
  'api_keys.delete': ROLES.SUPER_ADMIN
}

/**
 * 角色强度：数值越大权限越广
 * SUPER_ADMIN(4) > ADMIN(3) > SONG_ADMIN(2) > USER(1) > 未知(0)
 */
const ROLE_RANK: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.SONG_ADMIN]: 2,
  [ROLES.USER]: 1
}

function meetsRole(userRole: string | null | undefined, minRole: Role): boolean {
  if (!userRole) return false
  // 未知 role 一律视为最低权限
  const userRank = ROLE_RANK[userRole as Role] ?? 0
  return userRank >= ROLE_RANK[minRole]
}

/**
 * Legacy 权限校验入口（与 requirePermission 签名一致）
 *
 * 抛出 401（未登录）/ 403 COMMON_INSUFFICIENT_PERMISSION（角色不足）。
 * 不做个人加授 / 减授解析——仅按 user.role 字符串层级判断。
 */
export async function requireLegacyRoleCheck(
  event: H3Event,
  key: PermissionKey
) {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (user.status && user.status !== 'active') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE,
      '账号状态异常，无法执行此操作'
    )
  }

  const minRole = LEGACY_MIN_ROLE[key]
  if (!meetsRole(user.role, minRole)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      `缺少权限：${key}`
    )
  }

  return user
}
