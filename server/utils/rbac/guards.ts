/**
 * requirePermission — 业务接口统一权限校验 guard
 *
 * 替换 server/api/admin/** 中散落的
 *   if (!user || !['ADMIN','SUPER_ADMIN'].includes(user.role)) throw ...
 *
 * 用法：
 *   const user = await requirePermission(event, PERMISSIONS.USER_MANAGE)
 *
 * 行为：
 *   1. 校验 user.status === 'active'
 *   2. 取 user 有效权限集合（带缓存）
 *   3. 不在集合内抛 createApiError(403, COMMON_INSUFFICIENT_PERMISSION)
 */

import type { H3Event } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getUserPermissions } from './resolvePermissions'
import type { PermissionKey } from './constants'

export async function requirePermission(event: H3Event, key: PermissionKey) {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (user.status && user.status !== 'active') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE,
      '账号状态异常，无法执行此操作'
    )
  }

  const perms = await getUserPermissions(user.id)
  if (!perms.has(key)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      `缺少权限：${key}`
    )
  }

  return user
}

/**
 * requireSuperAdmin — 仅允许 SUPER_ADMIN 角色调用
 *
 * 用法：await requireSuperAdmin(event)
 *
 * 下沉到 server/utils/rbac/** 内，避免 server/api/** 中出现 user.role 字面量
 * 受 ESLint `voicehub/no-raw-role-check` 规则覆盖。
 */
export async function requireSuperAdmin(event: H3Event) {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (user.status && user.status !== 'active') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE,
      '账号状态异常，无法执行此操作'
    )
  }
  if (user.role !== 'SUPER_ADMIN') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      '此操作仅超级管理员可执行'
    )
  }
  return user
}

/**
 * 静默判断当前用户是否为 SUPER_ADMIN（不抛错）
 *
 * 用于在同一接口内需要按角色分支处理逻辑（如系统设置中仅 SUPER_ADMIN 可改主题），
 * 避免在 server/api/** 中出现 user.role 字面量。
 */
export function isSuperAdmin(user: { role?: string } | null | undefined): boolean {
  return !!user && user.role === 'SUPER_ADMIN'
}

/**
 * 静默判断是否为 ADMIN 或 SUPER_ADMIN
 * 接受 role 字符串而非 user 对象，避免在 server/api/** 中读 user.role 字面量
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/**
 * 提取用户身份字段（id / username / name / role 等）用于登录响应
 *
 * server/api/auth/** 需要把用户字段返回给客户端，但 ESLint 禁止直接读 user.role。
 * 通过本函数下沉到 rbac 子目录处理，server/api 调用时不出现 user.role 字面量。
 */
export function extractUserIdentity<
  T extends {
    id: number
    username?: string | null
    name?: string | null
    role?: string
    grade?: string | null
    class?: string | null
    email?: string | null
    emailVerified?: boolean | null
    forcePasswordChange?: boolean | null
    passwordChangedAt?: Date | null
  }
>(user: T) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    grade: user.grade,
    class: user.class,
    email: user.email,
    emailVerified: user.emailVerified,
    forcePasswordChange: user.forcePasswordChange,
    passwordChangedAt: user.passwordChangedAt
  }
}

/**
 * 校验多权限（任一满足即可）
 */
export async function requireAnyPermission(event: H3Event, keys: PermissionKey[]) {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (user.status && user.status !== 'active') {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE,
      '账号状态异常，无法执行此操作'
    )
  }

  const perms = await getUserPermissions(user.id)
  const matched = keys.find((k) => perms.has(k))
  if (!matched) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      `缺少任一权限：${keys.join(', ')}`
    )
  }
  return user
}
