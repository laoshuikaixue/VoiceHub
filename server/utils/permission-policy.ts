/**
 * 权限矩阵与按用户授权的纯策略（无数据库依赖，前后端判定口径一致）。
 *
 * 站点级能力（PROTECTED_PRIV_CODES）不允许被移出最后一个持有者；priv:admin-console 还额外不允许
 * 从操作者本人身上撤掉，避免一次误操作把全站锁在无人可再授权的状态。
 * 授权人只能授予自己已持有的码，防止普通管理员通过按用户授权提权。
 */
import {
  ADMIN_PERMISSION_CODES,
  MAX_SUPER_ADMIN_ACCOUNTS,
  PRIV_ADMIN_CONSOLE,
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  SUPER_ADMIN_ROLE,
  canGrantPermissionToken,
  getRoleTemplateKeys,
  isValidRoleKey,
  canAccessAdminConsole,
  hasPermission,
  isValidPermissionToken,
  normalizePermissionTokens,
  resolveRoleTemplate,
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

// 每个码的持有者用户 ID：有效权限 = 角色模板 ∪ 显式授予，显式拒绝优先。
// 持有者必须是"真的能用上"的账号：进不了后台的账号（如降级后只剩显式授权）无法再执行任何站点级操作，不计入。
export function collectCodeHolders(
  rows: readonly PermissionHolderRow[],
  templates: Record<string, unknown> | null,
  codes: readonly string[] = ADMIN_PERMISSION_CODES
): PermissionCodeHolders {
  const holders: PermissionCodeHolders = Object.fromEntries(
    codes.map((code) => [code, [] as number[]])
  )
  for (const row of rows) {
    const perms = resolveEffectivePermissions(row, templates)
    if (!canAccessAdminConsole(perms)) continue
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
  const unknownRoles = Object.keys(source).filter((role) => !isValidRoleKey(role))
  if (unknownRoles.length) {
    return fail(SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, '存在不可配置的角色', unknownRoles)
  }
  const result: Record<string, string[]> = {}
  for (const role of getRoleTemplateKeys(source)) {
    const value = source[role]
    if (value === undefined) {
      result[role] = [...(ROLE_PERMISSION_TEMPLATES_DEFAULT[role] ?? [])]
      continue
    }
    if (!Array.isArray(value)) {
      return fail(SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, `${role} 的模板必须是权限码数组`)
    }
    const invalid = value.filter(
      (token) => !isValidPermissionToken(typeof token === 'string' ? token.trim() : token)
    )
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
  const invalid = input.filter(
    (token) => !isValidPermissionToken(typeof token === 'string' ? token.trim() : token)
  )
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
  return tokens.filter(
    (token) => !canGrantPermissionToken(token, operatorPerms, ADMIN_PERMISSION_CODES)
  )
}

// 新增和移除拒绝项都会改变权限，恢复模板也必须校验变更范围。
export function findGrantChangesBeyondOperator(
  before: unknown,
  after: unknown,
  operatorPerms: readonly string[]
): string[] {
  const previous = normalizePermissionTokens(before)
  const next = normalizePermissionTokens(after)
  const changed = [
    ...previous.filter((token) => !next.includes(token)),
    ...next.filter((token) => !previous.includes(token))
  ]
  return findGrantsBeyondOperator(changed, operatorPerms)
}

export function findRoleTemplateChangesBeyondOperator(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
  operatorPerms: readonly string[]
): string[] {
  return getRoleTemplateKeys({ ...before, ...after }).flatMap((role) =>
    findGrantChangesBeyondOperator(
      resolveRoleTemplate(role, before),
      resolveRoleTemplate(role, after),
      operatorPerms
    ).map((token) => `${role}:${token}`)
  )
}

export function findAddedPermissionsBeyondOperator(
  before: readonly string[],
  after: readonly string[],
  operatorPerms: readonly string[]
): string[] {
  return ADMIN_PERMISSION_CODES.filter(
    (code) =>
      !hasPermission(before, code) &&
      hasPermission(after, code) &&
      !hasPermission(operatorPerms, code)
  )
}

/**
 * 账号变更（删除/停用/降级）前后的站点级能力对比。
 * nextRow 为 null 表示该账号从持有者集合中移除（已删除或不再是活跃后台账号）。
 */
export interface AccountChange {
  targetId: number
  nextRow: PermissionHolderRow | null
}

export function findProtectedLossAfterReplacements(
  rows: readonly PermissionHolderRow[],
  templates: Record<string, unknown> | null,
  changes: readonly AccountChange[],
  operatorId: number
): PolicyViolation | null {
  const before = collectCodeHolders(rows, templates, PROTECTED_PRIV_CODES)
  const changedIds = new Set(changes.map((change) => change.targetId))
  const remaining = rows.filter((row) => !changedIds.has(row.id))
  const nextRows = changes
    .map((change) => change.nextRow)
    .filter((row): row is PermissionHolderRow => row !== null)
  const after = collectCodeHolders([...remaining, ...nextRows], templates, PROTECTED_PRIV_CODES)
  return findProtectedCodeLoss(before, after, operatorId)
}

export function findProtectedLossAfterReplacement(
  rows: readonly PermissionHolderRow[],
  templates: Record<string, unknown> | null,
  targetId: number,
  nextRow: PermissionHolderRow | null,
  operatorId: number
): PolicyViolation | null {
  return findProtectedLossAfterReplacements(rows, templates, [{ targetId, nextRow }], operatorId)
}

// 新建账号尚未落库，用哨兵 ID 0 参与计数（serial 主键从 1 起）
export const NEW_ACCOUNT_ID = 0

/**
 * 超级管理员数量不变量：变更后活跃超管账号不得为零，也不得超过上限。
 * 站点级能力的安全阀只约束权限码持有者，超管身份本身需要单独兜底。
 */
export function findSuperAdminCountViolation(
  rows: readonly PermissionHolderRow[],
  changes: readonly AccountChange[],
  max: number = MAX_SUPER_ADMIN_ACCOUNTS
): PolicyViolation | null {
  const changedIds = new Set(changes.map((change) => change.targetId))
  const nextRows = [
    ...rows.filter((row) => !changedIds.has(row.id)),
    ...changes
      .map((change) => change.nextRow)
      .filter((row): row is PermissionHolderRow => row !== null)
  ]
  // 不涉超管身份的变更不参与计数，避免存量超管为零的站点被所有账号变更拦住
  const touchesSuperAdmin = changes.some(
    (change) =>
      rows.find((row) => row.id === change.targetId)?.role === SUPER_ADMIN_ROLE ||
      change.nextRow?.role === SUPER_ADMIN_ROLE
  )
  if (!touchesSuperAdmin) return null
  const count = nextRows.filter((row) => row.role === SUPER_ADMIN_ROLE).length
  if (count === 0) {
    return {
      status: 403,
      code: SERVER_ERROR_CODES.PERMISSION_LAST_SUPER_ADMIN_PROTECTED,
      message: '必须保留至少一个活跃的超级管理员账号'
    }
  }
  if (count > max) {
    return {
      status: 403,
      code: SERVER_ERROR_CODES.PERMISSION_SUPER_ADMIN_LIMIT_REACHED,
      message: `超级管理员账号最多 ${max} 个`,
      params: [String(max)]
    }
  }
  return null
}

/**
 * 安全阀：比较变更前后的站点级能力持有者。
 * - 操作者失去 priv:admin-console → 拒绝；后台入口是所有站点级能力的载体，自己出去后就再也改不回来
 * - 某站点级能力从有持有者变成零持有者 → 拒绝（全站失去该能力）
 * 交出 priv:role-template / priv:grant 但仍有他人持有时放行，这是把能力交还给超管的唯一路径。
 */
export function findProtectedCodeLoss(
  before: PermissionCodeHolders,
  after: PermissionCodeHolders,
  operatorId: number
): PolicyViolation | null {
  for (const code of PROTECTED_PRIV_CODES) {
    const prevHolders = before[code] ?? []
    const nextHolders = after[code] ?? []
    const operatorLost = prevHolders.includes(operatorId) && !nextHolders.includes(operatorId)
    if (operatorLost && code === PRIV_ADMIN_CONSOLE) {
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
