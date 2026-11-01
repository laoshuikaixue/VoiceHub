import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getRolePermissionTemplatesCached } from '~~/server/utils/system-settings-helper'
import {
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  groupPermissionCodes,
  normalizePermissionTokens,
  resolveEffectivePermissions,
  splitGrantTokens
} from '~~/app/utils/admin-permissions'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'

// 单个用户的显式授权现状：跟随模板标记、授予/拒绝清单与解析后的有效权限
export default defineEventHandler(async (event) => {
  try {
    const targetId = Number.parseInt(String(getRouterParam(event, 'id')), 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的用户ID')
    }

    const [target] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        status: users.status,
        permissions: users.permissions
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1)

    if (!target) {
      throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
    }

    const templates = await getRolePermissionTemplatesCached()
    return {
      success: true,
      user: {
        id: target.id,
        name: target.name,
        username: target.username,
        role: target.role,
        status: target.status
      },
      followsTemplate: target.permissions === null || target.permissions === undefined,
      explicit: splitGrantTokens(target.permissions),
      template: normalizePermissionTokens(
        templates[target.role] ?? ROLE_PERMISSION_TEMPLATES_DEFAULT[target.role] ?? []
      ),
      effective: resolveEffectivePermissions(target, templates),
      groups: groupPermissionCodes(),
      protectedCodes: [...PROTECTED_PRIV_CODES]
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[Permissions] 读取用户显式授权失败:', error)
    throw createError({ statusCode: 500, message: '读取用户显式授权失败' })
  }
})
