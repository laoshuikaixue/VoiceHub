/**
 * S3-B3-3 验收测试：歌曲与排期域接线（批次 C）。
 *
 * 四层断言：
 *   1. **路由 → 权限**：每个文件在 routePermissionMap 的登记值与实际调用的具名策略一致；
 *   2. **minRole 等价性**：catalog 的 minRole 等于旧内联角色数组的最低角色（零行为变更的判据）；
 *   3. **4 角色拒绝矩阵**：用 catalog 派生的角色矩阵驱动 requirePermission，逐条断言四个角色；
 *   4. **静态接线**：路由文件里不得再出现内联角色数组 / 裸 .role 比较 / 旧式守卫。
 *
 * 另：schedule 域内 requireSongAdmin 调用点归零（兼容层导出保留，由 S3-B1 收尾）。
 */

import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { requirePermission } from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import { ROLE_PERMISSIONS, type PermissionKey } from '../../../../server/utils/rbac/constants.ts'
import { resolveRoutePermission } from '../../../../server/utils/rbac/routePermissionMap.ts'
import { minRoleOf, roleRank } from '../../../../shared/rbac/permission-catalog.js'

const ROOT = process.cwd()

type RouteEntry = {
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
  /** 旧内联判权的最低角色（本批接线的等价性基准） */
  legacyMinRole: string
}

const ROUTES: RouteEntry[] = [
  // ── admin/schedule（读 → schedule.read；发布 → schedule.publish；其余 → schedule.write）──
  { file: 'server/api/admin/schedule/bulk-draft.post.ts', method: 'POST', route: '/api/admin/schedule/bulk-draft', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/bulk-publish.post.ts', method: 'POST', route: '/api/admin/schedule/bulk-publish', permission: 'schedule.publish', policy: 'canPublishSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/copy.post.ts', method: 'POST', route: '/api/admin/schedule/copy', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/draft.post.ts', method: 'POST', route: '/api/admin/schedule/draft', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/full.get.ts', method: 'GET', route: '/api/admin/schedule/full', permission: 'schedule.read', policy: 'canReadSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/move-date.post.ts', method: 'POST', route: '/api/admin/schedule/move-date', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/publish.post.ts', method: 'POST', route: '/api/admin/schedule/publish', permission: 'schedule.publish', policy: 'canPublishSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/remove-all-date.post.ts', method: 'POST', route: '/api/admin/schedule/remove-all-date', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/remove.post.ts', method: 'POST', route: '/api/admin/schedule/remove', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/sequence.post.ts', method: 'POST', route: '/api/admin/schedule/sequence', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/song-pool.delete.ts', method: 'DELETE', route: '/api/admin/schedule/song-pool', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/song-pool.get.ts', method: 'GET', route: '/api/admin/schedule/song-pool', permission: 'schedule.read', policy: 'canReadSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule/song-pool.post.ts', method: 'POST', route: '/api/admin/schedule/song-pool', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/schedule.post.ts', method: 'POST', route: '/api/admin/schedule', permission: 'schedule.write', policy: 'canWriteSchedule', legacyMinRole: 'SONG_ADMIN' },

  // ── admin/songs（reject 线 → song.reject；其余 → song.write）──
  { file: 'server/api/admin/songs/batch-reject.post.ts', method: 'POST', route: '/api/admin/songs/batch-reject', permission: 'song.reject', policy: 'canRejectSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/songs/reject.post.ts', method: 'POST', route: '/api/admin/songs/reject', permission: 'song.reject', policy: 'canRejectSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/songs/cover.post.ts', method: 'POST', route: '/api/admin/songs/cover', permission: 'song.write', policy: 'canWriteSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/songs/delete.post.ts', method: 'POST', route: '/api/admin/songs/delete', permission: 'song.write', policy: 'canWriteSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/songs/duration.post.ts', method: 'POST', route: '/api/admin/songs/duration', permission: 'song.write', policy: 'canWriteSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/songs/mark-played.post.ts', method: 'POST', route: '/api/admin/songs/mark-played', permission: 'song.write', policy: 'canWriteSongs', legacyMinRole: 'SONG_ADMIN' },

  // ── 用户域里确有门槛的 3 条 songs 路由 ──
  { file: 'server/api/songs/[id]/update.put.ts', method: 'PUT', route: '/api/songs/12/update', permission: 'song.write', policy: 'canWriteSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/songs/[id]/voters.get.ts', method: 'GET', route: '/api/songs/12/voters', permission: 'song.read', policy: 'canReadSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/songs/add.post.ts', method: 'POST', route: '/api/songs/add', permission: 'song.write', policy: 'canWriteSongs', legacyMinRole: 'SONG_ADMIN' }
]

/** 软 admin 标记文件：判权走具名策略或内核谓词，但文件内不得再有角色字面量矩阵 */
const SOFT_FLAG_FILES: Array<{ file: string; marker: string }> = [
  { file: 'server/api/songs/import.post.ts', marker: 'isSongAdminRole(' },
  { file: 'server/api/admin/schedule/song-pool.get.ts', marker: 'isSuperAdmin(' }
]

const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const

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

test('批次C 路由 → 权限：登记值与具名策略调用一致', () => {
  for (const item of ROUTES) {
    assert.equal(
      resolveRoutePermission(item.method, item.route),
      item.permission,
      `${item.method} ${item.route}`
    )
    const text = readSource(item.file)
    assert.ok(text.includes(`${item.policy}(event)`), `${item.file} 必须通过 ${item.policy}(event) 接线`)
  }
})

test('批次C minRole 等价性：catalog minRole == 旧内联数组的最低角色', () => {
  for (const item of ROUTES) {
    assert.equal(minRoleOf(item.permission), item.legacyMinRole, `${item.permission} 的 minRole 漂移`)
  }
})

test('批次C 4 角色拒绝矩阵：角色矩阵 == minRole 层级派生结果', () => {
  for (const item of ROUTES) {
    const minRank = roleRank(item.legacyMinRole)
    for (const role of ROLES) {
      const fromMatrix = ROLE_PERMISSIONS[role].includes(item.permission)
      const fromRank = roleRank(role) >= minRank
      assert.equal(fromMatrix, fromRank, `${role} × ${item.permission}：矩阵与层级派生不一致`)
    }
  }

  // 抽样固化：本批三个权限的放行边界
  const expected: Array<[string, PermissionKey, string[]]> = [
    ['USER', 'song.read', []],
    ['USER', 'schedule.read', []],
    ['USER', 'schedule.publish', []],
    ['SONG_ADMIN', 'schedule.publish', ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']],
    ['ADMIN', 'song.write', ['ADMIN', 'SUPER_ADMIN']]
  ]
  for (const [role, permission, allowed] of expected) {
    assert.equal(
      ROLE_PERMISSIONS[role].includes(permission),
      allowed.includes(role),
      `${role} × ${permission}`
    )
  }
})

test('批次C 拒绝矩阵实跑：requirePermission 对 4 个角色逐条判定', async () => {
  const permissions: PermissionKey[] = ['song.read', 'song.write', 'song.reject', 'schedule.read', 'schedule.write', 'schedule.publish']
  for (const permission of permissions) {
    const minRank = roleRank(minRoleOf(permission) as string)
    for (const role of ROLES) {
      assert.equal(
        await allowedForRole(role, permission),
        roleRank(role) >= minRank,
        `${role} × ${permission}`
      )
    }
  }
})

test('批次C 三态收敛：未登录 401 / 账号异常 403 / 缺权限 403', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(anonymous, 'schedule.write', { resolveState: resolveForRole('SONG_ADMIN') }),
    (error: { statusCode?: number }) => error.statusCode === 401
  )

  const frozen = {
    context: { user: { id: 1, role: 'SONG_ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, 'schedule.write', { resolveState: resolveForRole('SONG_ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )

  const student = {
    context: { user: { id: 2, role: 'USER', status: 'active' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(student, 'song.write', { resolveState: resolveForRole('USER') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'COMMON_INSUFFICIENT_PERMISSION'
  )
})

test('批次C 静态接线：零内联角色数组 / 零裸 .role 比较 / 零旧式守卫', () => {
  const files = [...new Set([...ROUTES.map((item) => item.file), ...SOFT_FLAG_FILES.map((item) => item.file)])]
  for (const file of files) {
    const text = readSource(file)
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${file} 仍有角色字面量数组`
    )
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${file} 仍有 .role 比较`)
    assert.equal(/verifyAdminAuth|verifySuperAdminAuth/.test(text), false, `${file} 仍引用旧式守卫`)
  }

  for (const item of SOFT_FLAG_FILES) {
    assert.ok(readSource(item.file).includes(item.marker), `${item.file} 软标记未改用 ${item.marker}`)
  }
})

test('批次C requireSongAdmin 调用点：schedule 域内归零', () => {
  let output = ''
  try {
    output = execSync('git grep -l "requireSongAdmin(" -- server/api/admin/schedule server/api/admin/schedule.post.ts', {
      cwd: ROOT,
      encoding: 'utf8'
    }).trim()
  } catch {
    // git grep 无匹配时退出码非零 —— 那正是期望结果
    output = ''
  }
  assert.equal(output, '', `schedule 域仍有 requireSongAdmin 调用点：${output}`)
})
