/**
 * S3-B2-1 验收测试：users 域**读**端点接线（8 文件）。
 *
 * 三层断言：
 *   1. **路由 → 权限**：8 个读端点在 routePermissionMap 里的登记值（7 个 user.read、1 个 song.read）；
 *   2. **4 角色拒绝矩阵**：用 catalog 派生的权限集驱动 `requirePermission`（等价于 seed 后的
 *      `role_permissions`），逐条断言 USER / SONG_ADMIN / ADMIN / SUPER_ADMIN 的放行与拒绝；
 *   3. **静态接线 + 护栏**：路由文件里不得再出现内联角色数组 / 裸 `.role`；带 try/catch 的文件
 *      必须保留守卫异常（`error.statusCode` 原样抛出）—— 旧实现把 403 吞成 500，是本次修掉的真缺陷。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { requirePermission } from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import { ROLE_PERMISSIONS, type PermissionKey } from '../../../../server/utils/rbac/constants.ts'
import { resolveRoutePermission } from '../../../../server/utils/rbac/routePermissionMap.ts'

const ROOT = process.cwd()

/** 本批 8 个读端点 → 期望权限（song.read 那条见下方说明） */
const READ_ROUTES: Array<{
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
  /** 守卫是否位于 try 块内（会决定 catch 是否必须保留守卫异常） */
  guardInsideTry: boolean
}> = [
  { file: 'server/api/admin/users/index.get.ts', method: 'GET', route: '/api/admin/users', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: true },
  { file: 'server/api/admin/users/index.ts', method: 'GET', route: '/api/admin/users', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: false },
  { file: 'server/api/admin/users/options.get.ts', method: 'GET', route: '/api/admin/users/options', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: true },
  { file: 'server/api/admin/users/export.get.ts', method: 'GET', route: '/api/admin/users/export', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: true },
  { file: 'server/api/admin/users/status-logs.get.ts', method: 'GET', route: '/api/admin/users/status-logs', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: true },
  { file: 'server/api/admin/users/[id].get.ts', method: 'GET', route: '/api/admin/users/1', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: false },
  { file: 'server/api/admin/users/[id]/status-logs.get.ts', method: 'GET', route: '/api/admin/users/1/status-logs', permission: 'user.read', policy: 'canReadUsers', guardInsideTry: true },
  // 说明：TASKS.md 写「读类走 user.read」，但该端点返回歌曲/投票/重播数据，旧行为允许 SONG_ADMIN；
  // 取 song.read（minRole = SONG_ADMIN）才能满足「与旧判断逐条等价」，故此处显式记为偏差。
  { file: 'server/api/admin/users/[id]/songs.get.ts', method: 'GET', route: '/api/admin/users/1/songs', permission: 'song.read', policy: 'canReadSongs', guardInsideTry: true }
]

const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const

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

test('S3-B2-1 路由 → 权限：8 个读端点的登记值与具名策略一致', () => {
  for (const item of READ_ROUTES) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.ok(text.includes(`${item.policy}(event)`), `${item.file} 必须通过 ${item.policy}(event) 接线`)
  }
})

test('S3-B2-1 4 角色拒绝矩阵：user.read / song.read 的放行与拒绝符合预期', async () => {
  const expected: Record<string, { 'user.read': boolean; 'song.read': boolean }> = {
    USER: { 'user.read': false, 'song.read': false },
    SONG_ADMIN: { 'user.read': false, 'song.read': true },
    ADMIN: { 'user.read': true, 'song.read': true },
    SUPER_ADMIN: { 'user.read': true, 'song.read': true }
  }

  for (const role of ROLES) {
    for (const permission of ['user.read', 'song.read'] as PermissionKey[]) {
      assert.equal(
        await allowedForRole(role, permission),
        expected[role][permission],
        `${role} × ${permission}`
      )
    }
  }
})

test('S3-B2-1 未登录 401 / 账号异常 403（三态收敛到 guard）', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(anonymous, 'user.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number }) => error.statusCode === 401
  )

  const frozen = {
    context: { user: { id: 1, role: 'ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, 'user.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )
})

test('S3-B2-1 静态接线：8 个文件已无角色比较 / 内联角色数组 / 直读 context.user', () => {
  // 说明（与 TASKS.md 验收命令的偏差）：规划的 grep `\.role\b` 会把 **DB 列引用**也算进去
  // （如 `role: users.role`、`role: row.role`），那不是权限判断。这里断言真正要清零的三类：
  //   ① `.role ===` / `.role !==` 比较 ② `includes(...role)` 内联数组 ③ `event.context.user` 直读
  for (const item of READ_ROUTES) {
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${item.file} 仍有 .role 比较`)
    assert.equal(/includes\(\s*[\w.]*[Rr]ole/.test(text), false, `${item.file} 仍有内联角色数组判断`)    assert.equal(/context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user（应走 guard）`)
  }
})

test('S3-B2-1 护栏：守卫在 try 内的路由必须原样抛出守卫异常（不得吞成 500）', () => {
  for (const item of READ_ROUTES) {
    if (!item.guardInsideTry) continue
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    // 三种既有写法都接受：`if (error.statusCode) { throw error }` /
    // `if (error.statusCode) throw error` / `if ((error as any)?.statusCode) throw error`
    assert.ok(
      /\.statusCode[\s\S]{0,80}?throw error/.test(text),
      `${item.file} 的 catch 未保留守卫异常（401/403 会被转成 500）`
    )
  }
})
