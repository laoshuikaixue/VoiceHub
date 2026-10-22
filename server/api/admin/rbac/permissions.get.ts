import { defineEventHandler } from 'h3'
import { asc } from 'drizzle-orm'
import { db, permissions } from '~/drizzle/db'
import { canReadPermissions } from '~~/server/utils/rbac'

/**
 * 权限目录全量（按 category 分组）
 * GET /api/admin/rbac/permissions
 *
 * 权限：permissions.read（SUPER_ADMIN）
 * 说明：permissions 表不在内核隔离断言（kernel-isolation.mjs:86-98）的受限表内，故此处可直接查。
 */
export default defineEventHandler(async (event) => {
  await canReadPermissions(event)

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

  const grouped: Record<string, typeof rows> = {}
  for (const row of rows) {
    const bucket = grouped[row.category] ?? (grouped[row.category] = [])
    bucket.push(row)
  }

  return {
    success: true,
    data: {
      items: rows,
      grouped
    }
  }
})
