/**
 * 列出所有用户加授记录（spec [S6]）
 * GET /api/admin/rbac/user-permissions
 * 权限：user_permissions.manage
 */

import { db } from '~/drizzle/db'
import { permissions, userPermissions, users } from '~/drizzle/schema'
import { desc, eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.USER_PERMISSIONS_MANAGE)

  const rows = await db
    .select({
      id: userPermissions.id,
      userId: userPermissions.userId,
      userName: users.name,
      userUsername: users.username,
      permissionId: userPermissions.permissionId,
      permissionKey: permissions.key,
      permissionCategory: permissions.category,
      permissionDescriptionZh: permissions.descriptionZh,
      grantType: userPermissions.grantType,
      expiresAt: userPermissions.expiresAt,
      grantedBy: userPermissions.grantedBy,
      reason: userPermissions.reason,
      createdAt: userPermissions.createdAt
    })
    .from(userPermissions)
    .innerJoin(users, eq(userPermissions.userId, users.id))
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .orderBy(desc(userPermissions.createdAt))

  return {
    success: true,
    data: rows
  }
})
