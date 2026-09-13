/**
 * 列出所有权限定义（spec [S6]）
 * GET /api/admin/rbac/permissions
 * 权限：permissions.read
 */

import { db } from '~/drizzle/db'
import { permissions } from '~/drizzle/schema'
import { asc } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.PERMISSIONS_READ)

  const rows = await db
    .select({
      id: permissions.id,
      key: permissions.key,
      category: permissions.category,
      descriptionZh: permissions.descriptionZh,
      descriptionEn: permissions.descriptionEn,
      isApiPermission: permissions.isApiPermission
    })
    .from(permissions)
    .orderBy(asc(permissions.category), asc(permissions.key))

  // 按 category 分组
  const grouped: Record<string, typeof rows> = {}
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category].push(row)
  }

  return {
    success: true,
    data: {
      items: rows,
      grouped
    }
  }
})
