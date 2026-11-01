/**
 * 权限矩阵与按用户授权的服务端策略（安全阀唯一实现）。
 *
 * 站点级能力（PROTECTED_PRIV_CODES）不允许被移出最后一个持有者，也不允许操作者撤销自己的持有，
 * 避免一次误操作把全站锁在无人可再授权的状态。
 * 授权人只能授予自己已持有的码，防止 ADMIN 通过按用户授权提权。
 */
import { db } from '~/drizzle/db'
import { systemSettings, users } from '~/drizzle/schema'
import { and, count, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'
import { getRolePermissionTemplatesCached, getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import {
  ADMIN_CONSOLE_ROLES,
  ADMIN_PERMISSION_CODES,
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  ROLE_TEMPLATE_KEYS,
  groupPermissionCodes,
  hasPermission,
  isValidPermissionToken,
  normalizePermissionTokens,
  resolveEffectivePermissions
} from '~~/app/utils/admin-permissions'

export interface PermissionHolderRow {
  id: number
  role: string
  permissions: unknown
}

export interface PermissionCodeHolders {
  [code: string]: number[]
}

// 只有活跃用户才算持有者：停用账号无法进入后台，其权限随账号复活自动生效，不计入安全阀
export async function loadPermissionHolderRows(): Promise<PermissionHolderRow[]> {
  return db
    .select({ id: users.id, role: users.role, permissions: users.permissions })
    .from(users)
    .where(
      and(
        eq(users.status, 'active'),
        or(isNotNull(users.permissions), inArray(users.role, [...ADMIN_CONSOLE_ROLES]))
      )
    )
}

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
export function normalizeSubmittedTemplates(body: unknown): Record<string, string[]> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createApiError(400, SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, '权限模板格式非法')
  }
  const input = body as Record<string, unknown>
  const unknownKeys = Object.keys(input).filter((key) => !ROLE_TEMPLATE_KEYS.includes(key))
  if (unknownKeys.length) {
    throw createApiError(400, SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, '存在不可配置的角色', {
      params: [unknownKeys.join(', ')]
    })
  }
  const result: Record<string, string[]> = {}
  for (const role of ROLE_TEMPLATE_KEYS) {
    const value = input[role]
    if (value === undefined) {
      result[role] = [...(ROLE_PERMISSION_TEMPLATES_DEFAULT[role] ?? [])]
      continue
    }
    if (!Array.isArray(value)) {
      throw createApiError(400, SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID, `${role} 的模板必须是权限码数组`)
    }
    result[role] = assertValidTokens(value, SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID)
  }
  return result
}

// 显式授权提交校验：null 表示跟随角色模板
export function normalizeSubmittedGrants(value: unknown): string[] | null {
  if (value === null) return null
  if (!Array.isArray(value)) {
    throw createApiError(400, SERVER_ERROR_CODES.PERMISSION_GRANT_INVALID, '显式授权必须是权限码数组或 null')
  }
  return assertValidTokens(value, SERVER_ERROR_CODES.PERMISSION_GRANT_INVALID)
}

function assertValidTokens(value: readonly unknown[], code: string): string[] {
  const invalid = value.filter((item) => !isValidPermissionToken(typeof item === 'string' ? item.trim() : item))
  if (invalid.length) {
    throw createApiError(400, code, '存在权限目录外的权限码', {
      params: [invalid.map((item) => String(item)).join(', ')]
    })
  }
  return normalizePermissionTokens(value)
}

// 授权人只能授出自己已持有的码（含通配形态）
export function assertGrantsWithinOperator(tokens: readonly string[], operatorPerms: readonly string[]): void {
  const beyond = tokens.filter((token) => {
    const body = token.startsWith('!') ? token.slice(1) : token
    return !hasPermission(operatorPerms, body)
  })
  if (beyond.length) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.PERMISSION_GRANT_EXCEEDS_SELF,
      '只能授予自己持有的权限码',
      { params: [beyond.join(', ')] }
    )
  }
}

/**
 * 安全阀：比较变更前后的站点级能力持有者。
 * - 操作者失去自己原本持有的站点级能力 → 拒绝（防止自锁后无人能改回来）
 * - 某站点级能力从有持有者变成零持有者 → 拒绝（全站失去该能力）
 */
export function assertProtectedCodesSurvive(
  before: PermissionCodeHolders,
  after: PermissionCodeHolders,
  operatorId: number
): void {
  for (const code of PROTECTED_PRIV_CODES) {
    const prevHolders = before[code] ?? []
    const nextHolders = after[code] ?? []
    if (prevHolders.includes(operatorId) && !nextHolders.includes(operatorId)) {
      throw createApiError(403, SERVER_ERROR_CODES.PERMISSION_SELF_LOCKOUT, '不能撤销自己的站点级权限', {
        params: [code]
      })
    }
    if (prevHolders.length > 0 && nextHolders.length === 0) {
      throw createApiError(403, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED, '不能移除站点级权限的最后一个持有者', {
        params: [code]
      })
    }
  }
}

// 权限矩阵页数据：模板现状、内置默认、活跃用户持有者数与角色分布
export async function buildPermissionMatrix() {
  const settings = await getSystemSettingsCached()
  const configured = settings?.rolePermissionTemplates ?? null
  const templates = await getRolePermissionTemplatesCached()

  const rows = await loadPermissionHolderRows()
  const holders = collectCodeHolders(rows, templates)
  const roleCounts = await db
    .select({ role: users.role, count: count() })
    .from(users)
    .where(eq(users.status, 'active'))
    .groupBy(users.role)

  const holdersByRole: Record<string, number> = {}
  for (const row of roleCounts) holdersByRole[row.role] = Number(row.count)

  const configuredRoles =
    configured && typeof configured === 'object' && !Array.isArray(configured)
      ? Object.keys(configured).filter((role) => ROLE_TEMPLATE_KEYS.includes(role))
      : []

  return {
    groups: groupPermissionCodes(),
    roles: [...ROLE_TEMPLATE_KEYS],
    protectedCodes: [...PROTECTED_PRIV_CODES],
    templates: Object.fromEntries(
      ROLE_TEMPLATE_KEYS.map((role) => [role, normalizePermissionTokens(templates[role] ?? [])])
    ) as Record<string, string[]>,
    defaults: Object.fromEntries(
      ROLE_TEMPLATE_KEYS.map((role) => [role, [...(ROLE_PERMISSION_TEMPLATES_DEFAULT[role] ?? [])]])
    ) as Record<string, string[]>,
    customizedRoles: configuredRoles,
    codeHolders: Object.fromEntries(Object.entries(holders).map(([code, ids]) => [code, ids.length])),
    explicitGrantUsers: rows.filter((row) => row.permissions !== null && row.permissions !== undefined).length,
    holdersByRole,
    holderTotal: rows.length
  }
}

// 写回角色权限模板（无配置行时按系统设置默认值补建，与系统设置接口一致的建行方式）
export async function saveRolePermissionTemplates(templates: Record<string, string[]>) {
  const existing = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)
  if (existing.length) {
    await db
      .update(systemSettings)
      .set({ rolePermissionTemplates: templates })
      .where(eq(systemSettings.id, existing[0]!.id))
    return
  }
  await db.insert(systemSettings).values({ ...SYSTEM_SETTINGS_DEFAULTS, rolePermissionTemplates: templates })
}
