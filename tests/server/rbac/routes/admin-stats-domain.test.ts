/**
 * R2-J 验收测试：统计域 6 个路由接线（server/api/admin/stats/**）。
 *
 * 四层断言：
 *   1. **路由 → 权限**：登记值为 stats.read，且文件实际调用具名策略 canReadStats(event)；
 *   2. **minRole 等价性**：catalog 的 stats.read.minRole == 旧内联数组 ['SONG_ADMIN','ADMIN','SUPER_ADMIN'] 的最低角色（零行为变更判据）；
 *   3. **4 角色拒绝矩阵**：用 catalog 派生的角色矩阵驱动 requirePermission 逐条断言 USER / SONG_ADMIN / ADMIN / SUPER_ADMIN；
 *   4. **静态接线**：零内联角色数组 / 零裸 .role / 零 context.user 直读 / 零旧式守卫，且守卫在 try 之外。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { requirePermission } from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import { ROLE_PERMISSIONS, type PermissionKey } from '../../../../server/utils/rbac/constants.ts'
import { resolveRoutePermission } from '../../../../server/utils/rbac/routePermissionMap.ts'
import { canReadStats } from '../../../../server/utils/rbac/policies.ts'
import { minRoleOf, roleRank } from '../../../../shared/rbac/permission-catalog.js'

const ROOT = process.cwd()

type RouteEntry = {
  file: string
  route: string
  legacyMinRole: string
}

/** 统计域 6 个路由文件：现状内联守卫最低角色均为 SONG_ADMIN */
const ROUTES: RouteEntry[] = [
  { file: 'server/api/admin/stats/active-users.get.ts', route: '/api/admin/stats/active-users', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/stats/realtime.get.ts', route: '/api/admin/stats/realtime', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/stats/semester-comparison.get.ts', route: '/api/admin/stats/semester-comparison', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/stats/top-songs.get.ts', route: '/api/admin/stats/top-songs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/stats/trends.get.ts', route: '/api/admin/stats/trends', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/stats/user-engagement.get.ts', route: '/api/admin/stats/user-engagement', legacyMinRole: 'SONG_ADMIN' }
]

const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const
const PERMISSION: PermissionKey = 'stats.read'

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

test('R2-J 路由 → 权限：stats 域 6 条路由登记为 stats.read 且调用 canReadStats(event)', () => {
  assert.equal(typeof canReadStats, 'function')
  for (const item of ROUTES) {
    assert.equal(resolveRoutePermission('GET', item.route), PERMISSION, `GET ${item.route}`)
    const text = readSource(item.file)
    assert.ok(text.includes('canReadStats(event)'), `${item.file} 必须通过 canReadStats(event) 接线`)
    assert.ok(
      text.includes("import { canReadStats } from '~~/server/utils/rbac'"),
      `${item.file} 必须从内核 barrel 导入 canReadStats`
    )
  }
})

test('R2-J 守卫位置：canReadStats(event) 必须出现在 try 之外（先于 try 块）', () => {
  for (const item of ROUTES) {
    const text = readSource(item.file)
    const guardAt = text.indexOf('canReadStats(event)')
    const tryAt = text.indexOf('try {')
    assert.ok(guardAt > -1, `${item.file} 缺少守卫`)
    assert.ok(tryAt > -1, `${item.file} 缺少 try 块`)
    assert.ok(guardAt < tryAt, `${item.file} 守卫落在 try 内，403 会被 catch 改写成 500`)
  }
})

test('R2-J minRole 等价性：stats.read 的 catalog minRole == 旧内联数组最低角色 SONG_ADMIN', () => {
  assert.equal(minRoleOf(PERMISSION), 'SONG_ADMIN')
  for (const item of ROUTES) {
    assert.equal(minRoleOf(PERMISSION), item.legacyMinRole, `${item.file} 的等价性基准漂移`)
  }
})

test('R2-J 4 角色拒绝矩阵：角色矩阵 == minRole 层级派生结果', () => {
  const minRank = roleRank('SONG_ADMIN')
  for (const role of ROLES) {
    const fromMatrix = ROLE_PERMISSIONS[role].includes(PERMISSION)
    const fromRank = roleRank(role) >= minRank
    assert.equal(fromMatrix, fromRank, `${role} × ${PERMISSION}：矩阵与层级派生不一致`)
  }
  // 边界固化：旧内联数组等价于「SONG_ADMIN 及以上」，USER 被拒
  assert.deepEqual(
    ROLES.filter((role) => ROLE_PERMISSIONS[role].includes(PERMISSION)),
    ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']
  )
})

test('R2-J 拒绝矩阵实跑：requirePermission 对 4 个角色逐条判定', async () => {
  const minRank = roleRank('SONG_ADMIN')
  for (const role of ROLES) {
    assert.equal(
      await allowedForRole(role, PERMISSION),
      roleRank(role) >= minRank,
      `${role} × ${PERMISSION}`
    )
  }
})

test('R2-J 三态收敛：未登录 401 / 账号异常 403 / 缺权限 403', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(anonymous, PERMISSION, { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number }) => error.statusCode === 401
  )

  const frozen = {
    context: { user: { id: 1, role: 'ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, PERMISSION, { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )

  const student = {
    context: { user: { id: 2, role: 'USER', status: 'active' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(student, PERMISSION, { resolveState: resolveForRole('USER') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'COMMON_INSUFFICIENT_PERMISSION'
  )
})

test('R2-J 静态接线：零内联角色数组 / 零裸 .role / 零 context.user / 零旧式守卫', () => {
  for (const item of ROUTES) {
    const text = readSource(item.file)
    for (const roleLiteral of ["'USER'", "'SONG_ADMIN'", "'ADMIN'", "'SUPER_ADMIN'"]) {
      assert.equal(text.includes(roleLiteral), false, `${item.file} 仍有角色字面量 ${roleLiteral}`)
    }
    assert.equal(text.includes('.role'), false, `${item.file} 仍有 .role 读取`)
    assert.equal(text.includes('context.user'), false, `${item.file} 仍在直读 event.context.user`)
    assert.equal(text.includes('verifyAdminAuth'), false, `${item.file} 仍引用旧式守卫`)
    assert.equal(text.includes('verifySuperAdminAuth'), false, `${item.file} 仍引用旧式守卫`)
  }
  // active-users 守卫收敛后 createError 已无使用处，import 必须一并删除
  const activeUsers = readSource('server/api/admin/stats/active-users.get.ts')
  assert.equal(activeUsers.includes('createError'), false, 'active-users.get.ts 残留未使用的 createError')
})
