/**
 * 权限矩阵与按用户授权的服务端数据层：DB 读写 + 把纯策略的判定结果转成 API 错误。
 *
 * 安全阀与校验口径的唯一实现在 server/utils/permission-policy.ts（可被测试直接加载）。
 */
import { db } from '~/drizzle/db'
import { systemSettings, users } from '~/drizzle/schema'
import { and, count, eq, sql } from 'drizzle-orm'
import { getRequestURL, type H3Event } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getClientIP } from '~~/server/utils/ip-utils'
import { PASSWORD_AUDIT_ACTIONS, recordPasswordAudit } from '~~/server/services/passwordSecurityService'
import { createBatchSystemNotifications } from '~~/server/services/notificationService'
import { SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'
import {
  getRolePermissionTemplatesCached,
  getSystemSettingsCached
} from '~~/server/utils/system-settings-helper'
import {
  collectCodeHolders,
  findAddedPermissionsBeyondOperator,
  findGrantsBeyondOperator,
  findGrantChangesBeyondOperator,
  findRoleTemplateChangesBeyondOperator,
  findProtectedCodeLoss,
  findProtectedLossAfterReplacements,
  findSuperAdminCountViolation,
  validateExplicitGrants,
  validateRoleTemplates
} from './permission-policy'
import type {
  AccountChange,
  PermissionCodeHolders,
  PermissionHolderRow,
  PolicyViolation
} from './permission-policy'
import {
  ADMIN_PERMISSION_CODES,
  PRIV_ADMIN_CONSOLE,
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  SUPER_ADMIN_ROLE,
  getRoleTemplateKeys,
  groupPermissionCodes,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isSuperAdminRoleTransition,
  resolveEffectivePermissions,
  normalizePermissionTokens
} from '~~/app/utils/admin-permissions'
import { resolvePermissionRouteGuard } from './admin-permission-routes'
import { requireStepUp } from './step-up'

export type PermissionTransaction = Pick<
  typeof db,
  'select' | 'update' | 'insert' | 'delete' | 'execute'
>

// 所有权限与账号变更共用事务锁；锁内刷新操作者，防止等待期间撤权后继续写入。
export async function withPermissionTransaction<T>(
  event: H3Event,
  callback: (tx: PermissionTransaction, templates: Record<string, unknown>) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(19830, 1)`)
    const templates = await getRolePermissionTemplatesCached(tx)
    const [operator] = await tx
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        permissions: users.permissions,
        tokenVersion: users.tokenVersion,
        forcePasswordChange: users.forcePasswordChange
      })
      .from(users)
      .where(eq(users.id, event.context.user.id))
      .limit(1)
    const perms = resolveEffectivePermissions(operator, templates)
    const guard = resolvePermissionRouteGuard(getRequestURL(event).pathname, event.method)
    if (
      !operator ||
      operator.status !== 'active' ||
      operator.forcePasswordChange ||
      (operator.tokenVersion ?? 0) !== (event.context.user.tokenVersion ?? 0) ||
      !hasPermission(perms, PRIV_ADMIN_CONSOLE) ||
      !guard ||
      guard.deny ||
      !hasAllPermissions(perms, guard.all) ||
      !hasAnyPermission(perms, guard.any)
    ) {
      throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '权限不足')
    }
    Object.assign(event.context.user, { role: operator.role, perms })
    return callback(tx, templates)
  })
}

// 只有活跃用户才算持有者：停用账号无法进入后台，其权限随账号复活自动生效，不计入安全阀。
// 所有角色都可能通过模板或显式授权获得后台权限，不能按角色提前过滤。
export async function loadPermissionHolderRows(
  executor: Pick<typeof db, 'select'> = db
): Promise<PermissionHolderRow[]> {
  const query = executor
    .select({ id: users.id, role: users.role, permissions: users.permissions })
    .from(users)
    .where(eq(users.status, 'active'))
  return query
}

// 角色模板的权限变更受操作者权限范围约束。
export function assertRoleTemplateExpansionWithinOperator(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, string[]>,
  operatorPerms: readonly string[]
): void {
  const violations = findRoleTemplateChangesBeyondOperator(before, after, operatorPerms)
  if (violations.length) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.PERMISSION_GRANT_EXCEEDS_SELF,
      '角色模板不能新增操作者未持有的权限码',
      { params: [violations.join(', ')] }
    )
  }
}

export function assertGrantChangesWithinOperator(
  before: unknown,
  after: unknown,
  operatorPerms: readonly string[]
): void {
  const beyond = findGrantChangesBeyondOperator(before, after, operatorPerms)
  if (beyond.length) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.PERMISSION_GRANT_EXCEEDS_SELF,
      '只能修改自己持有的权限码',
      { params: [beyond.join(', ')] }
    )
  }
}

export function assertAccountPermissionExpansion(
  before: { role: string; permissions: unknown; status: string } | null,
  after: { role: string; permissions: unknown; status: string },
  templates: Record<string, unknown>,
  operatorPerms: readonly string[]
): void {
  const previous = before?.status === 'active' ? resolveEffectivePermissions(before, templates) : []
  const next = after.status === 'active' ? resolveEffectivePermissions(after, templates) : []
  const beyond = findAddedPermissionsBeyondOperator(previous, next, operatorPerms)
  if (beyond.length) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.PERMISSION_GRANT_EXCEEDS_SELF,
      '不能通过账号变更授出自己未持有的权限',
      { params: [beyond.join(', ')] }
    )
  }
}

export function assertAccountCredentialsWithinOperator(
  target: { role: string; permissions: unknown },
  templates: Record<string, unknown>,
  operatorPerms: readonly string[]
): void {
  const targetPerms = resolveEffectivePermissions(target, templates)
  assertGrantsWithinOperator(
    ADMIN_PERMISSION_CODES.filter((code) => hasPermission(targetPerms, code)),
    operatorPerms
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
export function assertGrantsWithinOperator(
  tokens: readonly string[],
  operatorPerms: readonly string[]
): void {
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

// 安全阀：操作者不得丢掉后台准入，站点级能力不得失去最后一个持有者
export function assertProtectedCodesSurvive(
  before: PermissionCodeHolders,
  after: PermissionCodeHolders,
  operatorId: number
): void {
  const loss = findProtectedCodeLoss(before, after, operatorId)
  if (loss) rethrow(loss)
}

/**
 * 删除/停用/降级后台账号前的安全阀：nextRow 为 null 表示账号退出持有者集合。
 * 账号消失后，它独占的站点级能力就再没有账号能恢复。
 */
export async function assertProtectedCodesAfterAccountChanges(
  changes: readonly AccountChange[],
  operatorId: number,
  executor: PermissionTransaction,
  templates: Record<string, unknown>
): Promise<void> {
  if (!changes.length) return
  const rows = await loadPermissionHolderRows(executor)
  const loss = findProtectedLossAfterReplacements(rows, templates, changes, operatorId)
  if (loss) rethrow(loss)
}

export async function assertProtectedCodesAfterAccountChange(
  targetId: number,
  nextRow: PermissionHolderRow | null,
  operatorId: number,
  executor: PermissionTransaction,
  templates: Record<string, unknown>
): Promise<void> {
  await assertProtectedCodesAfterAccountChanges(
    [{ targetId, nextRow }],
    operatorId,
    executor,
    templates
  )
}

/**
 * 超管数量不变量：必须在共同事务锁内调用，nextRow 为 null 表示账号退出活跃集合。
 */
export async function assertSuperAdminCountInvariant(
  changes: readonly AccountChange[],
  executor: PermissionTransaction
): Promise<void> {
  if (!changes.length) return
  const rows = await loadPermissionHolderRows(executor)
  const violation = findSuperAdminCountViolation(rows, changes)
  if (violation) rethrow(violation)
}

export async function assertSuperAdminCountAfterAccountChange(
  targetId: number,
  nextRow: PermissionHolderRow | null,
  executor: PermissionTransaction
): Promise<void> {
  await assertSuperAdminCountInvariant([{ targetId, nextRow }], executor)
}

/**
 * 超管身份变更的统一准入：仅现有超管可执行，且必须处于二次验证窗口内。
 * previousRole 为 null 表示新建账号，nextRole 为 null 表示账号退出。
 */
export async function assertSuperAdminRoleChangeAllowed(
  event: H3Event,
  operator: { role?: string } | null | undefined,
  previousRole: string | null,
  nextRole: string | null
): Promise<void> {
  if (!isSuperAdminRoleTransition(previousRole, nextRole)) return
  if (operator?.role !== SUPER_ADMIN_ROLE) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.PERMISSION_SUPER_ADMIN_OPERATOR_REQUIRED,
      '超级管理员身份只能由现有超级管理员变更'
    )
  }
  await requireStepUp(event, 'super-admin-role')
}

/**
 * 超管身份变更留痕：写入口令审计流水，并通知全部活跃超管与目标账号。
 * 必须在事务提交后调用：内部走全局连接，在事务内申请第二个连接会阻塞。
 * 通知失败不回滚已完成的授权变更，只记录服务端告警。
 */
export async function recordSuperAdminRoleChange(
  event: H3Event,
  actor: { id: number; name?: string | null; username?: string | null },
  target: { id: number; username: string },
  granted: boolean
): Promise<void> {
  const action = granted
    ? PASSWORD_AUDIT_ACTIONS.GRANT_SUPER_ADMIN
    : PASSWORD_AUDIT_ACTIONS.REVOKE_SUPER_ADMIN
  await recordPasswordAudit(event, target.id, action, true, undefined, actor.id)

  try {
    const holders = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, SUPER_ADMIN_ROLE), eq(users.status, 'active')))
    const recipients = [...new Set([...holders.map((row) => row.id), actor.id, target.id])]
    const actorName = actor.name || actor.username || `#${actor.id}`
    const title = granted ? '已新增超级管理员' : '已撤销超级管理员'
    const content = `${title}：账号 ${target.username}，操作人 ${actorName}，IP ${getClientIP(event) || '未知'}`
    await createBatchSystemNotifications(recipients, title, content, true)
  } catch (error) {
    console.error('[Permissions] 超管身份变更通知失败:', error)
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
      ? Object.keys(configured).filter((role) => getRoleTemplateKeys(configured).includes(role))
      : []

  return {
    groups: groupPermissionCodes(),
    roles: getRoleTemplateKeys(templates),
    protectedCodes: [...PROTECTED_PRIV_CODES],
    templates: Object.fromEntries(
      getRoleTemplateKeys(templates).map((role) => [role, normalizePermissionTokens(templates[role] ?? [])])
    ) as Record<string, string[]>,
    defaults: Object.fromEntries(
      getRoleTemplateKeys(templates).map((role) => [role, [...(ROLE_PERMISSION_TEMPLATES_DEFAULT[role] ?? [])]])
    ) as Record<string, string[]>,
    customizedRoles: configuredRoles,
    codeHolders: Object.fromEntries(
      Object.entries(holders).map(([code, ids]) => [code, ids.length])
    ),
    explicitGrantUsers: rows.filter(
      (row) => row.permissions !== null && row.permissions !== undefined
    ).length,
    holdersByRole,
    holderTotal: holders[PRIV_ADMIN_CONSOLE]?.length ?? 0
  }
}

// 写回角色权限模板（无配置行时按系统设置默认值补建，与系统设置接口一致的建行方式）
export async function saveRolePermissionTemplates(
  templates: Record<string, string[]>,
  executor: PermissionTransaction
) {
  const existing = await executor.select({ id: systemSettings.id }).from(systemSettings).limit(1)
  if (existing.length) {
    await executor
      .update(systemSettings)
      .set({ rolePermissionTemplates: templates })
      .where(eq(systemSettings.id, existing[0]!.id))
    return
  }
  await executor
    .insert(systemSettings)
    .values({ ...SYSTEM_SETTINGS_DEFAULTS, rolePermissionTemplates: templates })
}
