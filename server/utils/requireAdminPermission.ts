import type { H3Event } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  ADMIN_ACCESS_ROLES,
  SUPER_ADMIN_ROLES,
  SYSTEM_ADMIN_ROLES,
  resolveEffectivePermissions,
  type AdminPermissionCode
} from '~~/server/utils/adminPermissions'

function getUserPermissions(event: H3Event): AdminPermissionCode[] {
  return resolveEffectivePermissions(event.context.user)
}

function hasAdminPermission(event: H3Event, code: AdminPermissionCode): boolean {
  return getUserPermissions(event).includes(code)
}

// 后台准入：仅校验角色，不含细粒度权限
export function requireAdminAccess(event: H3Event): void {
  requireRoleTier(event, ADMIN_ACCESS_ROLES, '需要管理员权限')
}

// 管理员及以上档位（人员管理等），不随歌曲管理员授权变化
export function requireSystemAdmin(event: H3Event): void {
  requireRoleTier(event, SYSTEM_ADMIN_ROLES, '需要管理员权限')
}

export function requireSuperAdmin(event: H3Event): void {
  requireRoleTier(event, SUPER_ADMIN_ROLES, '需要超级管理员权限')
}

function requireRoleTier(event: H3Event, roles: readonly string[], denyMessage: string): void {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!roles.includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, denyMessage)
  }
  if (user.status !== 'active') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE,
      '账号状态异常，无法执行此操作'
    )
  }
}

export function requireAdminPermission(event: H3Event, code: AdminPermissionCode): void {
  requireAdminAccess(event)
  if (!hasAdminPermission(event, code)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      '权限不足，无法执行此操作'
    )
  }
}
