import { defineEventHandler } from 'h3'
import { ROLES, canReadPermissions, loadRolePermissionRows } from '~~/server/utils/rbac'

/**
 * 角色 × 权限矩阵
 * GET /api/admin/rbac/roles
 *
 * 权限：permissions.read（SUPER_ADMIN）
 * 说明：role_permissions 表受内核隔离断言（kernel-isolation.mjs:86-98）限制，
 * 只有 server/utils/rbac/resolvePermissions.ts 可直查，故此处经内核函数取行。
 */
export default defineEventHandler(async (event) => {
  await canReadPermissions(event)

  const rows = await loadRolePermissionRows()

  const matrix: Record<string, string[]> = {
    [ROLES.USER]: [],
    [ROLES.SONG_ADMIN]: [],
    [ROLES.ADMIN]: [],
    [ROLES.SUPER_ADMIN]: []
  }
  for (const { roleName, permissionKey } of rows) {
    const bucket = Object.hasOwn(matrix, roleName) ? matrix[roleName] : undefined
    if (bucket) bucket.push(permissionKey)
  }

  return {
    success: true,
    data: {
      roles: Object.values(ROLES),
      matrix
    }
  }
})
