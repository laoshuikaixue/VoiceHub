/**
 * S3-B3-2 验收测试：基础数据与运营域接线（27 个路由文件）。
 *
 * 四层断言：
 *   1. **路由 → 权限**：每个文件在 routePermissionMap 的登记值与实际调用的具名策略一致；
 *   2. **minRole 等价性**：catalog 的 minRole 等于旧内联角色数组里的最低角色（零行为变更的判据）；
 *   3. **4 角色拒绝矩阵**：用 catalog 派生的角色矩阵（等价于 seed 后的 role_permissions）驱动
 *      requirePermission，逐条断言 USER / SONG_ADMIN / ADMIN / SUPER_ADMIN 的放行与拒绝；
 *   4. **静态接线**：路由文件里不得再出现内联角色数组 / 裸 .role / 直读 context.user / 旧式守卫。
 */

import assert from 'node:assert/strict'
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
  // play-times → playtimes.manage（SONG_ADMIN）
  { file: 'server/api/admin/play-times/index.ts', method: 'GET', route: '/api/admin/play-times', permission: 'playtimes.manage', policy: 'canManagePlayTimes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/play-times/index.post.ts', method: 'POST', route: '/api/admin/play-times', permission: 'playtimes.manage', policy: 'canManagePlayTimes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/play-times/[id].ts', method: 'GET', route: '/api/admin/play-times/1', permission: 'playtimes.manage', policy: 'canManagePlayTimes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/play-times/[id].ts', method: 'DELETE', route: '/api/admin/play-times/1', permission: 'playtimes.manage', policy: 'canManagePlayTimes', legacyMinRole: 'SONG_ADMIN' },

  // request-times → request_times.manage（SONG_ADMIN）
  { file: 'server/api/admin/request-times/index.ts', method: 'GET', route: '/api/admin/request-times', permission: 'request_times.manage', policy: 'canManageRequestTimes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/request-times/index.post.ts', method: 'POST', route: '/api/admin/request-times', permission: 'request_times.manage', policy: 'canManageRequestTimes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/request-times/[id].ts', method: 'DELETE', route: '/api/admin/request-times/1', permission: 'request_times.manage', policy: 'canManageRequestTimes', legacyMinRole: 'SONG_ADMIN' },

  // semesters → semester.manage（SONG_ADMIN）
  { file: 'server/api/admin/semesters/index.get.ts', method: 'GET', route: '/api/admin/semesters', permission: 'semester.manage', policy: 'canManageSemesters', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/semesters/index.post.ts', method: 'POST', route: '/api/admin/semesters', permission: 'semester.manage', policy: 'canManageSemesters', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/semesters/[id].put.ts', method: 'PUT', route: '/api/admin/semesters/1', permission: 'semester.manage', policy: 'canManageSemesters', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/semesters/[id].delete.ts', method: 'DELETE', route: '/api/admin/semesters/1', permission: 'semester.manage', policy: 'canManageSemesters', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/semesters/set-active.post.ts', method: 'POST', route: '/api/admin/semesters/set-active', permission: 'semester.manage', policy: 'canManageSemesters', legacyMinRole: 'SONG_ADMIN' },

  // grade-class → grade_class.manage（ADMIN）
  { file: 'server/api/admin/grade-class/index.get.ts', method: 'GET', route: '/api/admin/grade-class', permission: 'grade_class.manage', policy: 'canManageGradeClass', legacyMinRole: 'ADMIN' },
  { file: 'server/api/admin/grade-class/index.post.ts', method: 'POST', route: '/api/admin/grade-class', permission: 'grade_class.manage', policy: 'canManageGradeClass', legacyMinRole: 'ADMIN' },
  { file: 'server/api/admin/grade-class/[id].delete.ts', method: 'DELETE', route: '/api/admin/grade-class/1', permission: 'grade_class.manage', policy: 'canManageGradeClass', legacyMinRole: 'ADMIN' },
  { file: 'server/api/admin/grade-class/by-grade.delete.ts', method: 'DELETE', route: '/api/admin/grade-class/by-grade', permission: 'grade_class.manage', policy: 'canManageGradeClass', legacyMinRole: 'ADMIN' },
  { file: 'server/api/admin/grade-class/initialize.post.ts', method: 'POST', route: '/api/admin/grade-class/initialize', permission: 'grade_class.manage', policy: 'canManageGradeClass', legacyMinRole: 'ADMIN' },

  // card-codes 读 → card_codes.read；写 → card_codes.write（均 SONG_ADMIN）
  { file: 'server/api/admin/card-codes/index.get.ts', method: 'GET', route: '/api/admin/card-codes', permission: 'card_codes.read', policy: 'canReadCardCodes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/card-codes/export.get.ts', method: 'GET', route: '/api/admin/card-codes/export', permission: 'card_codes.read', policy: 'canReadCardCodes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/card-codes/redeem-logs.get.ts', method: 'GET', route: '/api/admin/card-codes/redeem-logs', permission: 'card_codes.read', policy: 'canReadCardCodes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/card-codes/create.post.ts', method: 'POST', route: '/api/admin/card-codes/create', permission: 'card_codes.write', policy: 'canWriteCardCodes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/card-codes/update.post.ts', method: 'POST', route: '/api/admin/card-codes/update', permission: 'card_codes.write', policy: 'canWriteCardCodes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/card-codes/[id].put.ts', method: 'PUT', route: '/api/admin/card-codes/1', permission: 'card_codes.write', policy: 'canWriteCardCodes', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/card-codes/delete.post.ts', method: 'POST', route: '/api/admin/card-codes/delete', permission: 'card_codes.write', policy: 'canWriteCardCodes', legacyMinRole: 'SONG_ADMIN' },

  // replay-requests → song.read / song.reject（SONG_ADMIN）
  { file: 'server/api/admin/replay-requests/index.get.ts', method: 'GET', route: '/api/admin/replay-requests', permission: 'song.read', policy: 'canReadSongs', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/replay-requests/reject.post.ts', method: 'POST', route: '/api/admin/replay-requests/reject', permission: 'song.reject', policy: 'canRejectSongs', legacyMinRole: 'SONG_ADMIN' },

  // stats / activities → stats.read（SONG_ADMIN）
  { file: 'server/api/admin/stats.get.ts', method: 'GET', route: '/api/admin/stats', permission: 'stats.read', policy: 'canReadStats', legacyMinRole: 'SONG_ADMIN' },
  { file: 'server/api/admin/activities.get.ts', method: 'GET', route: '/api/admin/activities', permission: 'stats.read', policy: 'canReadStats', legacyMinRole: 'SONG_ADMIN' }
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

test('S3-B3-2 路由 → 权限：登记值与具名策略调用一致', () => {
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

test('S3-B3-2 minRole 等价性：catalog minRole == 旧内联数组的最低角色', () => {
  for (const item of ROUTES) {
    assert.equal(minRoleOf(item.permission), item.legacyMinRole, `${item.permission} 的 minRole 漂移`)
  }
})

test('S3-B3-2 4 角色拒绝矩阵：角色矩阵 == minRole 层级派生结果', () => {
  for (const item of ROUTES) {
    const minRank = roleRank(item.legacyMinRole)
    for (const role of ROLES) {
      const fromMatrix = ROLE_PERMISSIONS[role].includes(item.permission)
      const fromRank = roleRank(role) >= minRank
      assert.equal(fromMatrix, fromRank, `${role} × ${item.permission}：矩阵与层级派生不一致`)
    }
  }

  // 抽样固化：本批每个权限的放行边界
  const expected: Array<[string, PermissionKey, string[]]> = [
    ['USER', 'playtimes.manage', []],
    ['SONG_ADMIN', 'playtimes.manage', ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']],
    ['ADMIN', 'grade_class.manage', ['ADMIN', 'SUPER_ADMIN']],
    ['SONG_ADMIN', 'grade_class.manage', []],
    ['SONG_ADMIN', 'card_codes.delete', []]
  ]
  for (const [role, permission, allowed] of expected) {
    assert.equal(
      ROLE_PERMISSIONS[role].includes(permission),
      allowed.includes(role),
      `${role} × ${permission}`
    )
  }
})

test('S3-B3-2 拒绝矩阵实跑：requirePermission 对 4 个角色逐条判定', async () => {
  const permissions: PermissionKey[] = ['playtimes.manage', 'request_times.manage', 'semester.manage', 'grade_class.manage', 'card_codes.read', 'card_codes.write', 'song.read', 'song.reject', 'stats.read']
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

test('S3-B3-2 三态收敛：未登录 401 / 账号异常 403 / 缺权限 403', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(anonymous, 'playtimes.manage', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number }) => error.statusCode === 401
  )

  const frozen = {
    context: { user: { id: 1, role: 'ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, 'playtimes.manage', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )

  const student = {
    context: { user: { id: 2, role: 'USER', status: 'active' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(student, 'stats.read', { resolveState: resolveForRole('USER') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'COMMON_INSUFFICIENT_PERMISSION'
  )
})

test('S3-B3-2 静态接线：零内联角色数组 / 零裸 .role / 零 context.user / 零旧式守卫', () => {
  for (const file of [...new Set(ROUTES.map((item) => item.file))]) {
    const text = readSource(file)
    assert.equal(/\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text), false, `${file} 仍有角色字面量数组`)
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${file} 仍有 .role 比较`)
    assert.equal(/context\.user/.test(text), false, `${file} 仍在直读 event.context.user`)
    assert.equal(/verifyAdminAuth|verifySuperAdminAuth/.test(text), false, `${file} 仍引用旧式守卫`)
  }
})
