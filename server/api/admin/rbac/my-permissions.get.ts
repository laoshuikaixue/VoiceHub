import { defineEventHandler } from 'h3'
import { getUserPermissionState, isSuperAdmin, requireActiveUser } from '~~/server/utils/rbac'

/**
 * 当前登录用户的权限集合（前端 useRbac 的单一数据源）
 * GET /api/admin/rbac/my-permissions
 *
 * 访问口径：仅需登录。本路由不在 routePermissionMap 的 ROUTE_RULES 内，只登记在
 * PUBLIC_ROUTE_PATTERNS（跳过权限判定）；/api/admin 的管理员门禁由 server/middleware/auth.ts:322-333 保证。
 */
export default defineEventHandler(async (event) => {
  const user = requireActiveUser(event)

  const state = await getUserPermissionState(user.id)

  return {
    success: true,
    data: {
      permissions: [...state.permissions].sort(),
      superAdmin: isSuperAdmin(user),
      degraded: state.degraded,
      degradedReason: state.degradedReason
    }
  }
})
