import { defineEventHandler } from 'h3'
import { canManageUserPermissions, loadUserPermissionGrants } from '~~/server/utils/rbac'
import { formatDateTime } from '~/utils/timeUtils'

/**
 * 个人加授 / 减授记录列表（按授予时间倒序）
 * GET /api/admin/rbac/user-permissions
 *
 * 权限：user_permissions.manage（SUPER_ADMIN）
 * 说明：user_permissions 表受内核隔离断言（kernel-isolation.mjs:86-98）限制，
 * 只有 server/utils/rbac/resolvePermissions.ts 可直查，故此处经内核函数取行。
 */
export default defineEventHandler(async (event) => {
  await canManageUserPermissions(event)

  const rows = await loadUserPermissionGrants()

  return {
    success: true,
    data: rows.map((row) => ({
      ...row,
      // 原始时间字段为无时区 UTC 墙钟，展示字段按北京时间格式化
      createdAtFormatted: formatDateTime(row.createdAt),
      expiresAtFormatted: row.expiresAt ? formatDateTime(row.expiresAt) : null
    }))
  }
})
