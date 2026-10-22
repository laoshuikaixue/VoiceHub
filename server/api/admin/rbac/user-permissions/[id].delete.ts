import { defineEventHandler, getRouterParam } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  canManageUserPermissions,
  deleteUserPermissionGrant,
  invalidateUserPermissions
} from '~~/server/utils/rbac'

/**
 * 撤销个人加授 / 减授记录
 * DELETE /api/admin/rbac/user-permissions/[id]
 *
 * 权限：user_permissions.manage（SUPER_ADMIN）
 * 按 id 删除；不存在 404。user_permissions 直查在内核（kernel-isolation.mjs:86-98）。
 */

export default defineEventHandler(async (event) => {
  await canManageUserPermissions(event)

  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `无效的加授记录 ID：${idParam}`)
  }

  const deleted = await deleteUserPermissionGrant(id)
  if (!deleted) {
    throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '加授记录不存在')
  }

  invalidateUserPermissions(deleted.userId)

  return {
    success: true,
    data: { id, userId: deleted.userId }
  }
})
