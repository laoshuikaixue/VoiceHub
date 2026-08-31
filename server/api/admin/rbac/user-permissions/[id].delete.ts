/**
 * 撤销用户加授记录（spec [S6]）
 * DELETE /api/admin/rbac/user-permissions/[id]
 * 权限：user_permissions.manage
 */

import { db } from '~/drizzle/db'
import { userPermissions } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'
import { rbacCache } from '~~/server/utils/rbac/cache'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.USER_PERMISSIONS_MANAGE)

  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的 user-permission id' })
  }

  // 先查 user_id 以便失效缓存
  const target = await db
    .select({ userId: userPermissions.userId })
    .from(userPermissions)
    .where(eq(userPermissions.id, id))
    .limit(1)

  if (!target[0]) {
    throw createError({ statusCode: 404, message: '用户加授记录不存在' })
  }

  await db.delete(userPermissions).where(eq(userPermissions.id, id))
  rbacCache.invalidate(target[0].userId)

  return { success: true, message: '加授已撤销' }
})
