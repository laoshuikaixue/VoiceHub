/**
 * resolveUserPermissions — RBAC 单一权威解析函数
 *
 * 规则（spec [S2.3]）：
 *   effective = (role_permissions[user.role]
 *               ∪ { p | assign grant 有效 })
 *             − { p | revoke grant 有效 }
 *
 * revoke 优先级高于 assign
 * 过期判定：expires_at IS NULL OR expires_at > now()
 */

import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import {
  permissions,
  rolePermissions,
  userPermissions,
  type User
} from '~/drizzle/schema'
import { LEGACY_PERMISSION_MAP, type PermissionKey } from './constants'
import { rbacCache } from './cache'

function toPermissionKey(value: string): PermissionKey | null {
  // 兼容读取期：旧冒号风格通过 LEGACY_PERMISSION_MAP 归一化
  const normalized = LEGACY_PERMISSION_MAP[value] ?? value
  // 仅返回在点分风格域内的值；未知权限跳过（视为无效）
  if (typeof normalized === 'string' && normalized.includes('.')) {
    return normalized as PermissionKey
  }
  return null
}

export async function resolveUserPermissions(userId: number): Promise<Set<PermissionKey>> {
  // 1. 角色权限
  const user = await db
    .select({ role: sql<string>`"User".role` })
    .from(sql`"User"`)
    .where(sql`"User".id = ${userId}`)
    .limit(1)

  const role = user[0]?.role ?? 'USER'
  const roleRows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.role, role))

  const result = new Set<PermissionKey>()
  for (const row of roleRows) {
    const key = toPermissionKey(row.key)
    if (key) result.add(key)
  }

  // 2. 个人加授 / 减授（未过期）
  const now = sql`now()`
  const grantRows = await db
    .select({
      key: permissions.key,
      grantType: userPermissions.grantType,
      expiresAt: userPermissions.expiresAt
    })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userPermissions.userId, userId),
        or(isNull(userPermissions.expiresAt), gt(userPermissions.expiresAt, now))
      )
    )

  for (const row of grantRows) {
    const key = toPermissionKey(row.key)
    if (!key) continue
    if (row.grantType === 'revoke') {
      result.delete(key)
    } else if (row.grantType === 'assign') {
      result.add(key)
    }
  }

  return result
}

/**
 * 带缓存的便捷封装
 */
export async function getUserPermissions(userId: number): Promise<Set<PermissionKey>> {
  return rbacCache.load(userId, () => resolveUserPermissions(userId))
}

/**
 * 简化接口：判断用户是否拥有某项权限
 */
export async function userHasPermission(
  user: Pick<User, 'id'>,
  key: PermissionKey
): Promise<boolean> {
  if (!user?.id) return false
  const perms = await getUserPermissions(user.id)
  return perms.has(key)
}
