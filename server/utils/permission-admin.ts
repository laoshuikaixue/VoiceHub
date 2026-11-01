/**
 * 权限矩阵与按用户授权的服务端数据层：DB 读写 + 把纯策略的判定结果转成 API 错误。
 *
 * 安全阀与校验口径的唯一实现在 server/utils/permission-policy.ts（可被测试直接加载）。
 */
import { db } from '~/drizzle/db'
import { systemSettings, users } from '~/drizzle/schema'
import { and, count, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'
import { getRolePermissionTemplatesCached, getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import {
  collectCodeHolders,
  findGrantsBeyondOperator,
  findProtectedCodeLoss,
  validateExplicitGrants,
  validateRoleTemplates
} from './permission-policy'
import type { PermissionCodeHolders, PermissionHolderRow, PolicyViolation } from './permission-policy'
import {
  ADMIN_CONSOLE_ROLES,
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  ROLE_TEMPLATE_KEYS,
  groupPermissionCodes,
  normalizePermissionTokens
} from '~~/app/utils/admin-permissions'

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

function rethrow(violation: PolicyViolation): never {
  throw createApiError(
    violation.status,
    violation.code,
    violation.message,
    violation.params ? { params: violation.params } : undefined
  )
}

// 模板提交校验：非法结构、未知角色、目录外权限码一律拒绝；缺省角色回落内置模板
export function normalizeSubmittedTemplates(body: unknown): Record<string, string[]> {
  const result = validateRoleTemplates(body)
  if (!result.ok) rethrow(result.violation)
  return result.value
}

// 显式授权提交校验：null 表示跟随角色模板
export function normalizeSubmittedGrants(value: unknown): string[] | null {
  const result = validateExplicitGrants(value)
  if (!result.ok) rethrow(result.violation)
  return result.value
}

// 授权人只能授出自己已持有的码（含通配形态）
export function assertGrantsWithinOperator(tokens: readonly string[], operatorPerms: readonly string[]): void {
  const beyond = findGrantsBeyondOperator(tokens, operatorPerms)
  if (beyond.length) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.PERMISSION_GRANT_EXCEEDS_SELF,
      '只能授予自己持有的权限码',
      { params: [beyond.join(', ')] }
    )
  }
}

// 安全阀：操作者不得自锁，站点级能力不得失去最后一个持有者
export function assertProtectedCodesSurvive(
  before: PermissionCodeHolders,
  after: PermissionCodeHolders,
  operatorId: number
): void {
  const loss = findProtectedCodeLoss(before, after, operatorId)
  if (loss) rethrow(loss)
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
