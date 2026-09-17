/**
 * 角色 × 权限矩阵（spec [S6]）
 * GET /api/admin/rbac/roles
 * 权限：permissions.read
 */

import { db } from '~/drizzle/db'
import { permissions, rolePermissions } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS, ROLES, type Role } from '~~/server/utils/rbac/constants'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.PERMISSIONS_READ)

  const rows = await db
    .select({
      role: rolePermissions.role,
      permissionKey: permissions.key,
      category: permissions.category
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))

  const matrix: Record<string, string[]> = {
    [ROLES.USER]: [],
    [ROLES.SONG_ADMIN]: [],
    [ROLES.ADMIN]: [],
    [ROLES.SUPER_ADMIN]: []
  }
  for (const row of rows) {
    if (matrix[row.role]) matrix[row.role].push(row.permissionKey)
  }

  return {
    success: true,
    data: {
      roles: Object.values(ROLES),
      matrix
    }
  }
})
