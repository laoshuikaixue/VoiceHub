import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canManageRoles, invalidateAllPermissions, replaceRolePermissions } from '~~/server/utils/rbac'

/**
 * 更新角色 × 权限矩阵（覆盖式）
 * PUT /api/admin/rbac/roles/[role]
 *
 * 权限：role.manage（SUPER_ADMIN）
 * 拒绝口径：未知角色 / 未知权限 key 400；SUPER_ADMIN 角色 403（防锁死）。
 * role_permissions 直查在内核（kernel-isolation.mjs:86-98），本文件不得出现表名。
 */

const bodySchema = z.object({
  permissions: z.array(z.string().min(1).max(100)).max(200)
})

export default defineEventHandler(async (event) => {
  await canManageRoles(event)

  const roleName = getRouterParam(event, 'role')
  if (!roleName) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少角色参数')
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `请求参数无效：${parsed.error.issues[0]?.message || 'permissions 必须为字符串数组'}`
    )
  }

  const result = await replaceRolePermissions(roleName, parsed.data.permissions)
  invalidateAllPermissions()

  return {
    success: true,
    data: {
      roleName: result.roleName,
      permissions: result.permissionKeys
    }
  }
})
