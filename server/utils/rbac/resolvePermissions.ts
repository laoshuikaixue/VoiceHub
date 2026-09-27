/**
 * resolveUserPermissions — RBAC 单一权威解析（S2-1 · R-26 / R-12 / R-13）
 *
 * 规则：effective = (role_permissions[role] ∪ assign) − revoke，**revoke 优先**；
 *       过期判定 `expires_at IS NULL OR expires_at > now()`（用数据库时钟，避免应用/DB 漂移）。
 *
 * 两条必须记住的历史教训（上一轮事故的根因）：
 *   1. **未知 key 不得静默入集合**：上一轮 `toPermissionKey` 只检查「含点」，`songs.read`
 *      这类错拼 key 会被静默收进权限集 → 运行时永不命中（与 API Key 全量 403 同源）。
 *      本次一律过 catalog 白名单（`normalizePermission` → `isPermissionKey`），未知即丢弃并
 *      记入 `unknownKeys` 供诊断。
 *   2. **seed 未就位不得把管理员判成无权**：`role_permissions` 整表为空时返回 `degraded`，
 *      由 guards 走 catalog 的 `minRole` 兜底并打 ERROR 日志（D6 / F-08）。
 *
 * 实现约束：
 *   - DB 访问用**动态 import**：本模块必须能被 plain node 直接 import 跑纯逻辑单测
 *     （tests/** 没有 Nuxt 别名解析器；且 `~/drizzle/db` 在缺 DATABASE_URL 时会直接抛错）。
 *   - 内核禁止 `Date.now()` / `new Date()`：时钟一律来自 cache 模块的注入点。
 *   - 本模块是权限解析的**唯一权威实现**（`scripts/contract-checks/kernel-isolation.mjs` 断言）。
 */

import { sql } from 'drizzle-orm'
import { isPermissionKey, normalizePermission, type PermissionKey } from './constants.ts'
import { createPermissionCache, type PermissionCache } from './cache.ts'

export type PermissionSet = ReadonlySet<PermissionKey>

export type PermissionGrantInput = { key: string; grantType: string | null }

export type PermissionState = {
  permissions: PermissionSet
  /** true = 角色矩阵为空（seed 未就位）：调用方必须走 catalog minRole 兜底 */
  degraded: boolean
  degradedReason: string | null
  /** 目录外的 key（诊断用；正常情况下为空） */
  unknownKeys: string[]
}

/** 归一化一组 raw key：点分直接过目录校验，冒号走 legacy 映射；未知单独收集 */
export function normalizePermissionKeys(rawKeys: string[]): { keys: PermissionKey[]; unknown: string[] } {
  const keys: PermissionKey[] = []
  const unknown: string[] = []
  for (const raw of rawKeys) {
    const normalized = normalizePermission(raw)
    if (normalized && isPermissionKey(normalized)) keys.push(normalized)
    else unknown.push(raw)
  }
  return { keys, unknown }
}

/**
 * 纯合并逻辑（无 DB）：(roleKeys ∪ assign) − revoke。
 * @param matrixRowCount `role_permissions` 表行数；0 ⇒ degraded（seed 未就位）
 */
export function mergePermissionState(input: {
  roleKeys: string[]
  grants: PermissionGrantInput[]
  matrixRowCount: number
}): PermissionState {
  const unknown: string[] = []

  const roleNormalized = normalizePermissionKeys(input.roleKeys)
  unknown.push(...roleNormalized.unknown)
  const permissions = new Set<PermissionKey>(roleNormalized.keys)

  const assigns: PermissionKey[] = []
  const revokes: PermissionKey[] = []
  for (const grant of input.grants) {
    const normalized = normalizePermissionKeys([grant.key])
    unknown.push(...normalized.unknown)
    const key = normalized.keys[0]
    if (!key) continue
    if (grant.grantType === 'revoke') revokes.push(key)
    else assigns.push(key)
  }

  // assign 先并入，revoke 后删除 → revoke 优先（两条记录同时存在时以 revoke 为准）
  for (const key of assigns) permissions.add(key)
  for (const key of revokes) permissions.delete(key)

  const degraded = input.matrixRowCount === 0
  return {
    permissions,
    degraded,
    degradedReason: degraded ? 'role_permissions 表为空（seed 未执行或未生效）' : null,
    unknownKeys: [...new Set(unknown)]
  }
}

type RawPermissionState = {
  roleKeys: string[]
  grants: PermissionGrantInput[]
  matrixRowCount: number
}

/** 默认 DB 加载器（动态 import：plain node 单测不会触发连接 / 不需要 DATABASE_URL） */
async function loadPermissionStateFromDatabase(userId: number): Promise<RawPermissionState> {
  const { db } = await import('~/drizzle/db')

  // postgres-js 驱动的 db.execute 返回 RowList（类数组），不是 node-postgres 的 { rows }
  const roleRows = (await db.execute<{ role: string | null }>(sql`
    SELECT role FROM "User" WHERE id = ${userId} LIMIT 1
  `)) as unknown as Array<{ role?: string | null }>
  const role = roleRows[0]?.role ?? 'USER'

  const matrixRows = (await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM role_permissions
  `)) as unknown as Array<{ count?: number }>
  const matrixRowCount = Number(matrixRows[0]?.count ?? 0)

  const roleKeyRows = (await db.execute<{ key: string }>(sql`
    SELECT p.key AS key
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp."permissionId"
    WHERE rp.role = ${role}
  `)) as unknown as Array<{ key: string }>

  const grantRows = (await db.execute<{ key: string; grantType: string | null }>(sql`
    SELECT p.key AS key, up."grantType" AS "grantType"
    FROM user_permissions up
    JOIN permissions p ON p.id = up."permissionId"
    WHERE up."userId" = ${userId}
      AND (up."expiresAt" IS NULL OR up."expiresAt" > now())
  `)) as unknown as Array<{ key: string; grantType: string | null }>

  return {
    roleKeys: roleKeyRows.map((row) => row.key),
    grants: grantRows.map((row) => ({ key: row.key, grantType: row.grantType })),
    matrixRowCount
  }
}

/** 解析（不走缓存）：DB → 纯合并 */
export async function resolvePermissionState(userId: number): Promise<PermissionState> {
  return mergePermissionState(await loadPermissionStateFromDatabase(userId))
}

/** 解析（不走缓存），只取权限集合 */
export async function resolveUserPermissions(userId: number): Promise<PermissionSet> {
  return (await resolvePermissionState(userId)).permissions
}

/**
 * 唯一缓存实例（TTL 60s + in-flight 去重），缓存值为 `PermissionState`，由本模块持有
 * （需要 `PermissionState` 类型，故不放在 cache.ts 里）。
 * degraded 态**不缓存**：缓存它会把「降级」冻成结果，且修复 seed 后要等 TTL 才恢复。
 */
export const rbacCache: PermissionCache<PermissionState> = createPermissionCache<PermissionState>()

/** 带缓存入口（guards 默认走它） */
export async function getUserPermissionState(userId: number): Promise<PermissionState> {
  return rbacCache.load(userId, () => resolvePermissionState(userId), {
    store: (state) => !state.degraded
  })
}

/** 带缓存入口，只取权限集合 */
export async function getUserPermissions(userId: number): Promise<PermissionSet> {
  return (await getUserPermissionState(userId)).permissions
}

/** 判断用户是否拥有某权限（带缓存） */
export async function userHasPermission(
  user: { id?: number | null } | null | undefined,
  key: PermissionKey
): Promise<boolean> {
  if (!user?.id) return false
  return (await getUserPermissions(user.id)).has(key)
}

/** 个人加授 / 减授变更后调用（必须在同一事务内） */
export function invalidateUserPermissions(userId: number): void {
  rbacCache.invalidate(userId)
}

/** 角色矩阵变更后调用 */
export function invalidateAllPermissions(): void {
  rbacCache.invalidateAll()
}
