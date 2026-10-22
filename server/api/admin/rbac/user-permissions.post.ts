import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  GRANT_TYPES,
  canManageUserPermissions,
  invalidateUserPermissions,
  requireActiveUser,
  upsertUserPermissionGrant
} from '~~/server/utils/rbac'

/**
 * 新增 / 更新个人加授（assign | revoke）
 * POST /api/admin/rbac/user-permissions
 *
 * 权限：user_permissions.manage（SUPER_ADMIN）
 * 按完整业务键 (userId, permissionId) upsert（表有 unique(userId, permissionId)），重复提交幂等。
 * user_permissions 直查在内核（kernel-isolation.mjs:86-98），本文件不得出现表名。
 */

const bodySchema = z.object({
  userId: z.number().int().positive(),
  permissionKey: z.string().min(1).max(100),
  grantType: z.enum([GRANT_TYPES.ASSIGN, GRANT_TYPES.REVOKE]),
  // null 必须排在 coerce.date() 之前：coerce 会把 null 强转成 1970 epoch
  expiresAt: z.union([z.null(), z.coerce.date()]).optional(),
  reason: z.union([z.string().max(500), z.null()]).optional()
})

export default defineEventHandler(async (event) => {
  await canManageUserPermissions(event)

  const operator = requireActiveUser(event)

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `请求参数无效：${parsed.error.issues[0]?.message || '未知错误'}`
    )
  }

  const result = await upsertUserPermissionGrant({
    userId: parsed.data.userId,
    permissionKey: parsed.data.permissionKey,
    grantType: parsed.data.grantType,
    expiresAt: parsed.data.expiresAt ?? null,
    grantedBy: operator.id,
    reason: parsed.data.reason ?? null
  })

  invalidateUserPermissions(parsed.data.userId)

  return {
    success: true,
    data: result
  }
})
