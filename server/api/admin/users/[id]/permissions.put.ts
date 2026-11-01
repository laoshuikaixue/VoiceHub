import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getRolePermissionTemplatesCached } from '~~/server/utils/system-settings-helper'
import {
  assertGrantsWithinOperator,
  assertProtectedCodesAfterAccountChange,
  normalizeSubmittedGrants
} from '~~/server/utils/permission-admin'
import type { PermissionHolderRow } from '~~/server/utils/permission-policy'
import { normalizePermissionTokens, splitGrantTokens } from '~~/app/utils/admin-permissions'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'

// 按用户显式授权：数组覆盖用户级权限码（模板 + 授予 − 拒绝），null 回到跟随角色模板
export default defineEventHandler(async (event) => {
  try {
    const { id: operatorId, perms: operatorPerms } = event.context.user

    const targetId = Number.parseInt(String(getRouterParam(event, 'id')), 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的用户ID')
    }

    const [target] = await db
      .select({ id: users.id, role: users.role, status: users.status, permissions: users.permissions })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1)

    if (!target) {
      throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
    }
    if (target.id === operatorId) {
      throw createApiError(403, SERVER_ERROR_CODES.PERMISSION_SELF_EDIT_FORBIDDEN, '不能修改自己的显式授权')
    }

    const { role: targetRole } = target
    const { role: operatorRole } = event.context.user
    if (targetRole === 'SUPER_ADMIN' && operatorRole !== 'SUPER_ADMIN') {
      throw createApiError(
        403,
        SERVER_ERROR_CODES.PERMISSION_GRANT_TARGET_FORBIDDEN,
        '超级管理员的显式授权仅可由超级管理员修改'
      )
    }

    const body = await readBody<Record<string, unknown> | null>(event)
    if (!body || !('permissions' in body)) {
      throw createApiError(400, SERVER_ERROR_CODES.PERMISSION_GRANT_INVALID, '缺少 permissions 字段')
    }

    const nextTokens = normalizeSubmittedGrants(body.permissions)
    if (nextTokens) assertGrantsWithinOperator(nextTokens, operatorPerms ?? [])

    const currentTemplates = await getRolePermissionTemplatesCached()
    const nextRow: PermissionHolderRow | null =
      target.status === 'active' ? { id: target.id, role: targetRole, permissions: nextTokens } : null
    await assertProtectedCodesAfterAccountChange(target.id, nextRow, operatorId)

    await db.update(users).set({ permissions: nextTokens }).where(eq(users.id, target.id))

    return {
      success: true,
      userId: target.id,
      followsTemplate: nextTokens === null,
      explicit: splitGrantTokens(nextTokens),
      template: normalizePermissionTokens(currentTemplates[targetRole] ?? [])
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[Permissions] 更新用户显式授权失败:', error)
    throw createError({ statusCode: 500, message: '更新用户显式授权失败' })
  }
})
