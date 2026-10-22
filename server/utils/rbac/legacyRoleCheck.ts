/**
 * Legacy 角色校验（`RBAC_ENABLED=false` 的应急回滚路径，S2-2 · D6 / R-25）
 *
 * 与上一轮的关键差异：**矩阵不再手抄**（R-32）。minRole 全部来自 catalog：
 *   roleHasPermission(role, key) ⇔ roleRank(role) ≥ roleRank(minRoleOf(key))
 * 因此它与 seed 写进 `role_permissions` 的矩阵同源（同一份 catalog 派生），**不可能漂移**；
 * 上一轮把 35 条 minRole 手抄进本文件，是「第二份字面量」的典型（本文件现在零 key 字面量）。
 *
 * 语义：仅按 `user.role` 层级判断，忽略个人加授 / 减授 —— 这正是 RBAC 重构前的行为。
 * 与 RBAC_ENABLED=false 的对照单测见 tests/server/rbac/kernel/legacy-fallback.test.ts。
 *
 * 本模块必须能被 plain node 直接 import（无 Nuxt 别名依赖）。
 */

import type { H3Event } from 'h3'
import { createApiError } from '../apiError.ts'
import { SERVER_ERROR_CODES } from '../../config/constants.ts'
import { isPermissionKey, roleHasPermission, type PermissionKey } from './constants.ts'

export type RequestUser = {
  id: number
  role?: string | null
  status?: string | null
  [key: string]: unknown
}

/** legacy 语义的权限判定：未知 key 一律拒绝（禁止 fail-open） */
export function legacyRoleHasPermission(role: string | null | undefined, key: PermissionKey): boolean {
  if (!isPermissionKey(key)) return false
  return roleHasPermission(role, key)
}

/** 401 / 403-账号异常 的统一前置校验（guards 与 legacy 路径共用同一形态） */
export function requireActiveUser(event: H3Event): RequestUser {
  const user = event.context.user as RequestUser | undefined
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
  return user
}

/** Legacy 权限校验入口（与 requirePermission 同签名、同三态） */
export async function requireLegacyRoleCheck(event: H3Event, key: PermissionKey): Promise<RequestUser> {
  const user = requireActiveUser(event)
  if (!legacyRoleHasPermission(user.role, key)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, `缺少权限：${key}`)
  }
  return user
}

/** Legacy 版「任一权限满足即可」（供 requireAnyPermission 在开关关闭 / 降级时复用） */
export async function requireLegacyAnyRoleCheck(
  event: H3Event,
  keys: PermissionKey[]
): Promise<RequestUser> {
  const user = requireActiveUser(event)
  const matched = keys.some((key) => legacyRoleHasPermission(user.role, key))
  if (!matched) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      `缺少任一权限：${keys.join(', ')}`
    )
  }
  return user
}
