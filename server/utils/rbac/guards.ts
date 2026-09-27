/**
 * RBAC guards（S2-2 · D6 / R-25 / R-42）
 *
 * 三态（上一轮已冻结的形状）：
 *   401 `AUTH_UNAUTHORIZED`                   未登录
 *   403 `AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE`  账号非 active
 *   403 `COMMON_INSUFFICIENT_PERMISSION`      缺权限（message 附 key）
 *
 * R-25：**所有** guard 共享同一个 `isRbacEnabled()` 语义。上一轮 `requireAnyPermission` 漏了
 * 这个分叉，导致应急回滚开关对它完全无效 —— 本文件两个 `require*` 都必须分叉。
 *
 * 降级（D6 / F-08）：`role_permissions` 整表为空（seed 未就位）时按 catalog 的 `minRole` 兜底
 * ——这与 `RBAC_ENABLED=false` 走同一段逻辑、同一结果——并打 ERROR 日志（带 `degraded` 标记），
 * 避免「seed 没跑 = 全员无权」这类静默灾难（归档 `sh/fix-rbac-seed.sql` 记录过该生产事故）。
 *
 * 供 `server/api/**` 使用的白名单函数（把 `.role` 读取引流到内核，避免裸读触发 ESLint 规则）：
 *   `isSuperAdmin` / `isAdminRole` / `isSongAdminRole` / `getUserRole` / `extractUserIdentity`；
 *   前四个同时接受「用户对象」与「role 字符串」两种形态。
 *
 * 本模块必须能被 plain node 直接 import（DB 访问在 resolvePermissions 内部动态 import）。
 */

import type { H3Event } from 'h3'
import { createApiError } from '../apiError.ts'
import { SERVER_ERROR_CODES } from '../../config/constants.ts'
import { getServerTimestamp } from '../serverTime.ts'
import { ROLES, isPermissionKey, type PermissionKey } from './constants.ts'
import { isRbacEnabled } from './fallback.ts'
import {
  requireActiveUser,
  requireLegacyAnyRoleCheck,
  requireLegacyRoleCheck,
  type RequestUser
} from './legacyRoleCheck.ts'
import { getUserPermissionState, type PermissionState } from './resolvePermissions.ts'

/** 测试注入点（生产代码不得传第三个参数） */
export type GuardDependencies = {
  resolveState?: (userId: number) => Promise<PermissionState>
  legacyCheck?: (event: H3Event, key: PermissionKey) => Promise<RequestUser>
  legacyAnyCheck?: (event: H3Event, keys: PermissionKey[]) => Promise<RequestUser>
  onDegraded?: (state: PermissionState) => void
}

const DEGRADED_LOG_INTERVAL_MS = 60_000
let lastDegradedLogAt = 0

/** 降级日志：60s 节流，避免每个请求都刷 ERROR */
function logDegraded(state: PermissionState): void {
  const now = getServerTimestamp()
  if (now - lastDegradedLogAt < DEGRADED_LOG_INTERVAL_MS) return
  lastDegradedLogAt = now
  console.error(
    `[rbac] ✖ 角色矩阵不可用，已降级到 catalog minRole 兜底（原因：${state.degradedReason ?? '未知'}）`
  )
}

function insufficientPermission(key: PermissionKey) {
  return createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, `缺少权限：${key}`)
}

async function authorize(event: H3Event, key: PermissionKey, deps: GuardDependencies): Promise<RequestUser> {
  // RBAC_ENABLED=false → 走 catalog 派生的 legacy 角色判断（紧急回滚路径）
  if (!isRbacEnabled()) {
    return (deps.legacyCheck ?? requireLegacyRoleCheck)(event, key)
  }

  const user = requireActiveUser(event)

  // catalog 里没有的 key = 调用方写错（如 songs.read 复数形），一律拒绝：禁止 fail-open
  if (!isPermissionKey(key)) throw insufficientPermission(key)

  const state = await (deps.resolveState ?? getUserPermissionState)(user.id)
  if (state.degraded) {
    ;(deps.onDegraded ?? logDegraded)(state)
    return (deps.legacyCheck ?? requireLegacyRoleCheck)(event, key)
  }

  if (!state.permissions.has(key)) throw insufficientPermission(key)
  return user
}

/** 单一权威权限 guard（S3 起所有 admin 路由都用它） */
export async function requirePermission(
  event: H3Event,
  key: PermissionKey,
  deps: GuardDependencies = {}
): Promise<RequestUser> {
  return authorize(event, key, deps)
}

/** 任一权限满足即可（注意：这里同样必须有 isRbacEnabled 分叉，见 R-25） */
export async function requireAnyPermission(
  event: H3Event,
  keys: PermissionKey[],
  deps: GuardDependencies = {}
): Promise<RequestUser> {
  if (!isRbacEnabled()) {
    return (deps.legacyAnyCheck ?? requireLegacyAnyRoleCheck)(event, keys)
  }

  const user = requireActiveUser(event)
  const knownKeys = keys.filter((key) => isPermissionKey(key))
  if (knownKeys.length === 0) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      `缺少任一权限：${keys.join(', ')}`
    )
  }

  const state = await (deps.resolveState ?? getUserPermissionState)(user.id)
  if (state.degraded) {
    ;(deps.onDegraded ?? logDegraded)(state)
    return (deps.legacyAnyCheck ?? requireLegacyAnyRoleCheck)(event, keys)
  }

  const matched = knownKeys.find((key) => state.permissions.has(key))
  if (!matched) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      `缺少任一权限：${keys.join(', ')}`
    )
  }
  return user
}

/**
 * 仅 SUPER_ADMIN 可执行。
 *
 * 与 `RBAC_ENABLED` 无关（读的是角色本身，两条路径行为 1:1 一致，故不分叉）；
 * 语义等价于 catalog 中 minRole = SUPER_ADMIN 的那批权限（如 `role.manage`）。
 */
export async function requireSuperAdmin(event: H3Event): Promise<RequestUser> {
  const user = requireActiveUser(event)
  if (getUserRole(user) !== ROLES.SUPER_ADMIN) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      '此操作仅超级管理员可执行'
    )
  }
  return user
}

/** 用户对象或 role 字符串 → role 字符串（未知形态一律 null） */
function resolveRoleValue(input: unknown): string | null {
  if (!input) return null
  if (typeof input === 'string') return input
  const role = (input as { role?: unknown }).role
  return typeof role === 'string' ? role : null
}

/** 静默判断是否 SUPER_ADMIN（不抛错；用于同一接口内的分支逻辑） */
export function isSuperAdmin(input: unknown): boolean {
  return resolveRoleValue(input) === ROLES.SUPER_ADMIN
}

/** 静默判断是否 ADMIN 或 SUPER_ADMIN */
export function isAdminRole(input: unknown): boolean {
  const role = resolveRoleValue(input)
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
}

/** 静默判断是否 SONG_ADMIN / ADMIN / SUPER_ADMIN */
export function isSongAdminRole(input: unknown): boolean {
  return resolveRoleValue(input) === ROLES.SONG_ADMIN || isAdminRole(input)
}

/** 取 role 字符串（JWT 签发等极少数场景；S3 用它替代裸读 `.role`） */
export function getUserRole(input: unknown): string | undefined {
  return resolveRoleValue(input) ?? undefined
}

/** 提取用户身份字段（登录 / 验证响应序列化用；字段集合与上一轮 1:1，避免响应形状漂移） */
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
