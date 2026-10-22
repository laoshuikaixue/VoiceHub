/**
 * S3-B(批次 G) 验收测试：用户侧与系统域接线（6 个端点）。
 *
 * 范围说明：这 6 个路径都**不在 `/api/admin/**` 下**，运行时门禁中间件不判权，判权归端点自身。
 * 因此本批分两类处理：
 *   1. `/api/system/status`、`/api/system/reconnect`：现状是拒绝式守卫 → 换成语义等价的具名策略
 *      （`canReadSystemSettings`，minRole = ADMIN = 旧内联数组的最低角色，零行为变更）；
 *   2. `/api/progress/id`、`/api/progress/events`、`/api/blacklist/check`、`/api/card-codes/validate`：
 *      内联数组用于**分支**而非拒绝（events 自校验 query token、blacklist 是「管理员免检」、
 *      card-codes 是「关闭时管理员仍可验证」）→ 只把裸 `.role` 读取换成内核白名单函数，
 *      控制流与放行集合逐条保持不变。
 *
 * 四层断言：路由登记值 / minRole 等价性 / 4 角色 + 未知角色的放行集合 / 静态接线与守卫位置。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { isAdminRole, isSongAdminRole, requirePermission } from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import { ROLE_PERMISSIONS, type PermissionKey } from '../../../../server/utils/rbac/constants.ts'
import { classifyApiRoute, resolveRoutePermission } from '../../../../server/utils/rbac/routePermissionMap.ts'
import { minRoleOf, roleRank } from '../../../../shared/rbac/permission-catalog.js'

const ROOT = process.cwd()
const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const

type GuardedEntry = {
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
  /** 旧内联判权的最低角色（等价性基准） */
  legacyMinRole: string
  /** 守卫是否位于 try 块外（守卫落在 try 内会被 catch 改写成 500） */
  guardOutsideTry: boolean
}

/** 拒绝式守卫的 2 个端点（换具名策略） */
const GUARDED: GuardedEntry[] = [
  { file: 'server/api/system/status.get.ts', method: 'GET', route: '/api/system/status', permission: 'stats.read', policy: 'canReadStats', legacyMinRole: 'SONG_ADMIN', guardOutsideTry: true },
  { file: 'server/api/system/reconnect.post.ts', method: 'POST', route: '/api/system/reconnect', permission: 'system_settings.read', policy: 'canReadSystemSettings', legacyMinRole: 'ADMIN', guardOutsideTry: true }
]

type BranchEntry = {
  file: string
  method: string
  route: string
  /** 白名单函数（原内联数组的等价物） */
  whitelist: 'isSongAdminRole' | 'isAdminRole'
  /** 旧内联数组里的最低角色 */
  legacyMinRole: string
  /** 是否仍允许直读 event.context.user（自校验令牌 / 免检分支，中间件不覆盖） */
  readsContextUser: boolean
}

/** 分支式（非拒绝式）判权的 4 个端点 */
const BRANCHED: BranchEntry[] = [
  { file: 'server/api/progress/id.ts', method: 'GET', route: '/api/progress/id', whitelist: 'isSongAdminRole', legacyMinRole: 'SONG_ADMIN', readsContextUser: true },
  { file: 'server/api/progress/events.ts', method: 'GET', route: '/api/progress/events', whitelist: 'isSongAdminRole', legacyMinRole: 'SONG_ADMIN', readsContextUser: true },
  { file: 'server/api/blacklist/check.post.ts', method: 'POST', route: '/api/blacklist/check', whitelist: 'isSongAdminRole', legacyMinRole: 'SONG_ADMIN', readsContextUser: true },
  { file: 'server/api/card-codes/validate.post.ts', method: 'POST', route: '/api/card-codes/validate', whitelist: 'isAdminRole', legacyMinRole: 'ADMIN', readsContextUser: true }
]

const ALL_FILES = [...new Set([...GUARDED.map((i) => i.file), ...BRANCHED.map((i) => i.file)])]

function readSource(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function createEvent(role: string) {
  return { context: { user: { id: 99, role, status: 'active' } } } as unknown as Parameters<typeof requirePermission>[0]
}

/** 用 catalog 派生的角色矩阵构造解析态（等价于 seed 后的 role_permissions） */
function resolveForRole(role: string) {
  return async () => mergePermissionState({ roleKeys: [...ROLE_PERMISSIONS[role]], grants: [], matrixRowCount: 1 })
}

async function allowedForRole(role: string, permission: PermissionKey): Promise<boolean> {
  try {
    await requirePermission(createEvent(role), permission, { resolveState: resolveForRole(role) })
    return true
  } catch {
    return false
  }
}

test('批次G 路由登记：6 个端点均不在 admin 域，判权归端点自身（login 兜底）', () => {
  for (const item of [...GUARDED, ...BRANCHED]) {
    const decision = classifyApiRoute(item.method, item.route)
    assert.equal(decision.decision, 'login', `${item.method} ${item.route} 应走 login 兜底（中间件不判权）`)
    assert.equal(resolveRoutePermission(item.method, item.route), null, `${item.route} 不应有映射权限`)
  }
})

test('批次G 具名策略接线：2 个拒绝式端点的登记 key 与调用一致', () => {
  for (const item of GUARDED) {
    assert.equal(resolveRoutePermission(item.method, item.route), null)
    const text = readSource(item.file)
    assert.ok(text.includes(`await ${item.policy}(event)`), `${item.file} 必须通过 ${item.policy}(event) 接线`)
  }
})

test('批次G minRole 等价性：所选 key 的 minRole == 旧内联数组最低角色', () => {
  for (const item of GUARDED) {
    assert.equal(minRoleOf(item.permission), item.legacyMinRole, `${item.permission} 的 minRole 漂移`)
  }
})

test('批次G 白名单函数等价性：与旧内联数组的放行集合逐条相同（含未知角色）', () => {
  // 旧写法：['SONG_ADMIN','ADMIN','SUPER_ADMIN'].includes(role) / ['ADMIN','SUPER_ADMIN'].includes(role)
  const legacySongAdmin = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']
  const legacyAdmin = ['ADMIN', 'SUPER_ADMIN']
  for (const role of [...ROLES, 'GUEST', undefined]) {
    assert.equal(isSongAdminRole(role), legacySongAdmin.includes(role as string), `isSongAdminRole × ${String(role)}`)
    assert.equal(isAdminRole(role), legacyAdmin.includes(role as string), `isAdminRole × ${String(role)}`)
  }
})

test('批次G 4 角色拒绝矩阵：本批两个 key 由 minRole 层级派生（含 SONG_ADMIN 放行边界）', async () => {
  for (const permission of ['stats.read', 'system_settings.read'] as PermissionKey[]) {
    const minRank = roleRank(minRoleOf(permission) as string)
    for (const role of ROLES) {
      assert.equal(
        await allowedForRole(role, permission),
        roleRank(role) >= minRank,
        `${role} × ${permission}`
      )
      assert.equal(
        ROLE_PERMISSIONS[role].includes(permission),
        roleRank(role) >= minRank,
        `${role} × ${permission}（矩阵与层级派生不一致）`
      )
    }
  }
  // 边界固化：status 端点旧行为放行 SONG_ADMIN（stats.read），reconnect 端点旧行为拒绝 SONG_ADMIN（system_settings.read）
  assert.equal(await allowedForRole('SONG_ADMIN', 'stats.read'), true)
  assert.equal(await allowedForRole('USER', 'stats.read'), false)
  assert.equal(await allowedForRole('SONG_ADMIN', 'system_settings.read'), false)
  assert.equal(await allowedForRole('ADMIN', 'system_settings.read'), true)
})

test('批次G 三态收敛：未登录 401 / 账号异常 403 / 缺权限 403', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(anonymous, 'system_settings.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number }) => error.statusCode === 401
  )

  const frozen = {
    context: { user: { id: 1, role: 'ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, 'system_settings.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )

  const student = {
    context: { user: { id: 2, role: 'USER', status: 'active' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(student, 'system_settings.read', { resolveState: resolveForRole('USER') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'COMMON_INSUFFICIENT_PERMISSION'
  )
})

test('批次G 守卫位置：拒绝式端点的守卫必须在 try 之外（否则 403 被 catch 改写成 500）', () => {
  for (const item of GUARDED) {
    const text = readSource(item.file)
    const guardAt = text.indexOf(`await ${item.policy}(event)`)
    const tryAt = text.indexOf('try {')
    assert.ok(guardAt >= 0, `${item.file} 未接线具名策略`)
    assert.ok(tryAt < 0 || guardAt < tryAt, `${item.file} 的守卫落在 try 内`)
    assert.equal(item.guardOutsideTry, true)
  }
})

test('批次G 静态接线：零内联角色数组 / 零 .role 比较 / 零旧式守卫', () => {
  for (const file of ALL_FILES) {
    const text = readSource(file)
    assert.equal(/\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text), false, `${file} 仍有角色字面量数组`)
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${file} 仍有 .role 比较`)
    assert.equal(/verifyAdminAuth|verifySuperAdminAuth/.test(text), false, `${file} 仍引用旧式守卫`)
  }
})

test('批次G 静态接线：分支式端点的白名单函数已接线，且未改成拒绝式守卫', () => {
  for (const item of BRANCHED) {
    const text = readSource(item.file)
    assert.ok(text.includes(`${item.whitelist}(`), `${item.file} 未使用白名单函数 ${item.whitelist}`)
    assert.equal(/requirePermission|requireSongAdmin/.test(text), false, `${item.file} 不应改成拒绝式守卫（语义会变）`)
  }

  // 免检语义固化：blacklist/check 的分支必须仍是「命中即早退返回 isBlocked: false」
  const blacklist = readSource('server/api/blacklist/check.post.ts')
  assert.ok(
    /if \(user && isSongAdminRole\(user\)\) \{[\s\S]{0,200}?isBlocked: false/.test(blacklist),
    'blacklist/check.post.ts 的免检分支语义被改动'
  )
})

test('批次G 静态接线：拒绝式端点不再直读 event.context.user，分支式端点允许', () => {
  for (const item of GUARDED) {
    assert.equal(/context\.user/.test(readSource(item.file)), false, `${item.file} 仍在直读 event.context.user`)
  }
  for (const item of BRANCHED) {
    assert.equal(item.readsContextUser, true)
  }
})
