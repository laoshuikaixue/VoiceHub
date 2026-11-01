/**
 * 权限矩阵与按用户授权的纯策略（无数据库依赖，前后端判定口径一致）。
 *
 * 站点级能力（PROTECTED_PRIV_CODES）不允许被移出最后一个持有者，也不允许操作者撤销自己的持有，
 * 避免一次误操作把全站锁在无人可再授权的状态。
 * 授权人只能授予自己已持有的码，防止普通管理员通过按用户授权提权。
 */
import {
  ADMIN_PERMISSION_CODES,
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  ROLE_TEMPLATE_KEYS,
  hasPermission,
  isValidPermissionToken,
  normalizePermissionTokens,
  resolveEffectivePermissions
} from '../../app/utils/admin-permissions.ts'
import { SERVER_ERROR_CODES } from '../config/constants.ts'

export interface PermissionHolderRow {
  id: number
  role: string
  permissions: unknown
}

export interface PermissionCodeHolders {
  [code: string]: number[]
}

export interface PolicyViolation {
  status: number
  code: string
  message: string
  params?: string[]
}

export type PolicyResult<T> = { ok: true; value: T } | { ok: false; violation: PolicyViolation }

// 校验类失败一律 400；安全阀属于权限越界，另行标记 403
const fail = (code: string, message: string, params?: string[]): PolicyResult<never> => ({
  ok: false,
  violation: { status: 400, code, message, params }
})

// 每个码的持有者用户 ID：有效权限 = 角色模板 ∪ 显式授予，显式拒绝优先
export function collectCodeHolders(
  rows: readonly PermissionHolderRow[],
  templates: Record<string, unknown> | null,
  codes: readonly string[] = ADMIN_PERMISSION_CODES
): PermissionCodeHolders {
  const holders: PermissionCodeHolders = Object.fromEntries(codes.map((code) => [code, [] as number[]]))
  for (const row of rows) {
    const perms = resolveEffectivePermissions(row, templates)
    for (const code of codes) {
      if (hasPermission(perms, code)) holders[code]!.push(row.id)
    }
  }
  return holders
}

// 模板提交校验：角色键受目录约束，码非法时报错而不是静默丢弃；缺省角色回落内置模板
export function validateRoleTemplates(input: unknown): PolicyResult<Record<string, string[]>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail(SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, '权限模板格式非法')
  }
  const source = input as Record<string, unknown>
  const unknownRoles = Object.keys(source).filter((role) => !ROLE_TEMPLATE_KEYS.includes(role))
  if (unknownRoles.length) {
    return fail(
      SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID,
      '存在不可配置的角色',
      unknownRoles
    )
  }
  const result: Record<string, string[]> = {}
  for (const role of ROLE_TEMPLATE_KEYS) {
    const value = source[role]
    if (value === undefined) {
      result[role] = [...(ROLE_PERMISSION_TEMPLATES_DEFAULT[role] ?? [])]
      continue
    }
    if (!Array.isArray(value)) {
      return fail(SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, `${role} 的模板必须是权限码数组`)
    }
    const invalid = value.filter((token) => !isValidPermissionToken(typeof token === 'string' ? token.trim() : token))
    if (invalid.length) {
      return fail(
        SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID,
        '存在权限目录外的权限码',
        invalid.map((token) => String(token))
      )
    }
    result[role] = normalizePermissionTokens(value)
  }
  return { ok: true, value: result }
}

// 显式授权提交校验：null 表示回到跟随角色模板
export function validateExplicitGrants(input: unknown): PolicyResult<string[] | null> {
  if (input === null) return { ok: true, value: null }
  if (!Array.isArray(input)) {
    return fail(SERVER_ERROR_CODES.PERMISSION_GRANT_INVALID, '显式授权必须是权限码数组或 null')
  }
  const invalid = input.filter((token) => !isValidPermissionToken(typeof token === 'string' ? token.trim() : token))
  if (invalid.length) {
    return fail(
      SERVER_ERROR_CODES.PERMISSION_GRANT_INVALID,
      '存在权限目录外的权限码',
      invalid.map((token) => String(token))
    )
  }
  return { ok: true, value: normalizePermissionTokens(input) }
}

// 授权人只能授出自己已持有的码（含通配形态），返回越权的码
export function findGrantsBeyondOperator(
  tokens: readonly string[],
  operatorPerms: readonly string[]
): string[] {
  return tokens.filter((token) => {
    const body = token.startsWith('!') ? token.slice(1) : token
    return !hasPermission(operatorPerms, body)
  })
}

/**
 * 安全阀：比较变更前后的站点级能力持有者。
 * - 操作者失去自己原本持有的站点级能力 → 拒绝（自锁后无人能改回来）
 * - 某站点级能力从有持有者变成零持有者 → 拒绝（全站失去该能力）
 */
export function findProtectedCodeLoss(
  before: PermissionCodeHolders,
  after: PermissionCodeHolders,
  operatorId: number
): PolicyViolation | null {
  for (const code of PROTECTED_PRIV_CODES) {
    const prevHolders = before[code] ?? []
    const nextHolders = after[code] ?? []
    if (prevHolders.includes(operatorId) && !nextHolders.includes(operatorId)) {
      return {
        status: 403,
        code: SERVER_ERROR_CODES.PERMISSION_SELF_LOCKOUT,
        message: '不能撤销自己的站点级权限',
        params: [code]
      }
    }
    if (prevHolders.length > 0 && nextHolders.length === 0) {
      return {
        status: 403,
        code: SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED,
        message: '不能移除站点级权限的最后一个持有者',
        params: [code]
      }
    }
  }
  return null
}
