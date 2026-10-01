/**
 * S3-B2-2 验收测试：users 域**写/批量**端点接线 + 8 处客体护栏（D8 / D20 修订版）。
 *
 * 本用例的第一部分是规划点名的 **8 处锚点**（行号为权威基线 `cc882ed` 的行号，便于 review 对照），
 * 每条都断言「ADMIN 对 SUPER_ADMIN 目标被拒」与「SUPER_ADMIN 放行」；
 * 第二部分是**静态接线断言**：路由文件里不得再出现角色名比较、角色字面量数组或直读 `event.context.user`；
 * 第三部分固定**批量端点的语义差异**：批量接口用不抛错的 `canMutateTarget`（收集错误逐条返回），
 * 单条接口用会抛 403 的 `assertCanMutateTarget`。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  assertCanAssignRole,
  assertCanMutateTarget,
  canAssignRole,
  canMutateTarget
} from '../../../../server/utils/rbac/policies.ts'
import { isStudentUser, isSuperAdmin } from '../../../../server/utils/rbac/guards.ts'

const ROOT = process.cwd()

type FakeError = { statusCode?: number; statusMessage?: string }

function createEvent(user: { id: number; role?: string | null; status?: string | null } | undefined) {
  return { context: { user } } as unknown as Parameters<typeof assertCanMutateTarget>[0]
}

async function capture(fn: () => unknown): Promise<FakeError | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error as FakeError
  }
}

const ADMIN = { id: 10, role: 'ADMIN', status: 'active' }
const SUPER_ADMIN = { id: 1, role: 'SUPER_ADMIN', status: 'active' }
const STUDENT = { id: 20, role: 'USER', status: 'active' }

test('S3-B2-2 锚点 1：`[id].put.ts:92` 越级修改保护（ADMIN → SUPER_ADMIN 被拒）', async () => {
  assert.equal(canMutateTarget(ADMIN, SUPER_ADMIN), false)
  assert.equal(canMutateTarget(SUPER_ADMIN, SUPER_ADMIN), true)
  const denied = await capture(() =>
    assertCanMutateTarget(createEvent(ADMIN), SUPER_ADMIN, { message: '权限不足：普通管理员无法修改超级管理员信息' })
  )
  assert.equal(denied?.statusCode, 403)
  assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
})

test('S3-B2-2 锚点 2：`[id].delete.ts:53` 越级删除保护', async () => {
  assert.equal(canMutateTarget(ADMIN, SUPER_ADMIN), false)
  assert.equal(canMutateTarget(SUPER_ADMIN, SUPER_ADMIN), true)
  const denied = await capture(() => assertCanMutateTarget(createEvent(ADMIN), SUPER_ADMIN))
  assert.equal(denied?.statusCode, 403)
})

test('S3-B2-2 锚点 3：`[id]/status.put.ts:68` 仅学生用户可改状态（SUPER_ADMIN 目标被拒）', () => {
  assert.equal(isStudentUser(STUDENT), true, '学生用户放行')
  assert.equal(isStudentUser(SUPER_ADMIN), false, 'SUPER_ADMIN 目标被拒（400 域规则）')
  assert.equal(isStudentUser(ADMIN), false, 'ADMIN 目标被拒')
})

test('S3-B2-2 锚点 4：`[id]/reset-password.post.ts:75` 越级重置密码保护', async () => {
  const denied = await capture(() =>
    assertCanMutateTarget(createEvent(ADMIN), SUPER_ADMIN, { message: '权限不足：普通管理员无法重置超级管理员密码' })
  )
  assert.equal(denied?.statusCode, 403)
  assert.equal(await capture(() => assertCanMutateTarget(createEvent(SUPER_ADMIN), SUPER_ADMIN)), null)
})

test('S3-B2-2 锚点 5/6：`batch-status.put.ts:120/124` 批量状态的两道客体护栏', () => {
  // 120：目标为 SUPER_ADMIN ⇒ 仅 SUPER_ADMIN 可操作（批量用不抛错谓词）
  assert.equal(canMutateTarget(ADMIN, SUPER_ADMIN), false)
  assert.equal(canMutateTarget(SUPER_ADMIN, SUPER_ADMIN), true)
  // 124：非 SUPER_ADMIN 的操作者不得批量改「非学生」目标
  assert.equal(!isSuperAdmin(ADMIN) && !isStudentUser(SUPER_ADMIN), true, 'ADMIN 改 SUPER_ADMIN：拒绝')
  assert.equal(!isSuperAdmin(ADMIN) && !isStudentUser(ADMIN), true, 'ADMIN 改 ADMIN：拒绝')
  assert.equal(!isSuperAdmin(ADMIN) && !isStudentUser(STUDENT), false, 'ADMIN 改学生：放行')
  assert.equal(!isSuperAdmin(SUPER_ADMIN) && !isStudentUser(ADMIN), false, 'SUPER_ADMIN 改 ADMIN：放行')
})

test('S3-B2-2 锚点 7：`batch-update.post.ts:110` 批量更新的越级保护', () => {
  assert.equal(canMutateTarget(ADMIN, SUPER_ADMIN), false)
  assert.equal(canMutateTarget(SUPER_ADMIN, SUPER_ADMIN), true)
})

test('S3-B2-2 锚点 8：`batch-grade-update.post.ts:122` 批量年级更新的越级保护', () => {
  assert.equal(canMutateTarget(ADMIN, SUPER_ADMIN), false)
  assert.equal(canMutateTarget(SUPER_ADMIN, SUPER_ADMIN), true)
  assert.equal(canMutateTarget(ADMIN, STUDENT), true, '学生目标不受该护栏影响（与旧行为一致）')
})

test('S3-B2-2 角色变更护栏：ADMIN 不能设 ADMIN / SUPER_ADMIN（旧实现同语义）', async () => {
  assert.equal(canAssignRole(ADMIN, 'SUPER_ADMIN'), false)
  assert.equal(canAssignRole(ADMIN, 'ADMIN'), false)
  assert.equal(canAssignRole(ADMIN, 'SONG_ADMIN'), true)
  const denied = await capture(() => assertCanAssignRole(createEvent(ADMIN), 'SUPER_ADMIN'))
  assert.equal(denied?.statusCode, 403)
  assert.equal(await capture(() => assertCanAssignRole(createEvent(SUPER_ADMIN), 'SUPER_ADMIN')), null)
})

/** 本批 10 个写/批量端点 → 期望的具名策略调用 */
const WRITE_ROUTES: Array<{ file: string; policies: string[]; batch: boolean }> = [
  { file: 'server/api/admin/users/[id].delete.ts', policies: ['canManageUsers', 'assertCanMutateTarget'], batch: false },
  {
    file: 'server/api/admin/users/[id].put.ts',
    policies: ['canManageUsers', 'assertCanMutateTarget', 'assertCanAssignRole'],
    batch: false
  },
  { file: 'server/api/admin/users/[id]/status.put.ts', policies: ['canChangeUserStatus', 'isStudentUser'], batch: false },
  {
    file: 'server/api/admin/users/[id]/reset-password.post.ts',
    policies: ['canManageUsers', 'assertCanMutateTarget'],
    batch: false
  },
  { file: 'server/api/admin/users/[id]/approval.post.ts', policies: ['canChangeUserStatus'], batch: false },
  { file: 'server/api/admin/users/index.post.ts', policies: ['canManageUsers', 'assertCanAssignRole'], batch: false },
  { file: 'server/api/admin/users/batch.post.ts', policies: ['canManageUsers', 'canAssignRole'], batch: true },
  { file: 'server/api/admin/users/batch-update.post.ts', policies: ['canManageUsers', 'canMutateTarget'], batch: true },
  {
    file: 'server/api/admin/users/batch-status.put.ts',
    policies: ['canChangeUserStatus', 'canMutateTarget', 'isStudentUser', 'isSuperAdmin'],
    batch: true
  },
  {
    file: 'server/api/admin/users/batch-grade-update.post.ts',
    policies: ['canManageUsers', 'canMutateTarget'],
    batch: true
  }
]

test('S3-B2-2 静态接线：10 个文件均已接入具名策略，且零角色比较 / 零角色字面量数组 / 零直读 context.user', () => {
  for (const item of WRITE_ROUTES) {
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')

    for (const policy of item.policies) {
      assert.ok(text.includes(policy), `${item.file} 未接入 ${policy}`)
    }

    // ① 角色名比较（旧的越级护栏形态）
    assert.equal(
      /\.role\s*(===|!==)\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'/.test(text),
      false,
      `${item.file} 仍有角色名比较`
    )
    // ② 角色字面量数组（旧的矩阵形态；`ROLE_ORDER.includes(x)` 这类目录派生校验不算）
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${item.file} 仍有角色字面量数组`
    )
    // ③ 直读 event.context.user
    assert.equal(/event\.context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user`)

    // 批量接口必须用**不抛错**的谓词（逐条收集错误），单条接口用 assert 版（直接 403）
    if (item.batch) {
      assert.equal(text.includes('assertCanMutateTarget('), false, `${item.file} 是批量接口，不应直接抛错`)
    }
  }
})

test('S3-B2-2 顶层守卫与路由映射一致：10 个端点取到的权限与 routePermissionMap 登记值相同', async () => {
  const { resolveRoutePermission } = await import('../../../../server/utils/rbac/routePermissionMap.ts')

  const expectations: Array<[string, string, string]> = [
    ['DELETE', '/api/admin/users/7', 'user.manage'],
    ['PUT', '/api/admin/users/7', 'user.manage'],
    ['PUT', '/api/admin/users/7/status', 'user.status'],
    ['POST', '/api/admin/users/7/reset-password', 'user.manage'],
    ['POST', '/api/admin/users/7/approval', 'user.status'],
    ['POST', '/api/admin/users', 'user.manage'],
    ['POST', '/api/admin/users/batch', 'user.manage'],
    ['POST', '/api/admin/users/batch-update', 'user.manage'],
    ['PUT', '/api/admin/users/batch-status', 'user.status'],
    ['POST', '/api/admin/users/batch-grade-update', 'user.manage']
  ]

  for (const [method, route, expected] of expectations) {
    assert.equal(resolveRoutePermission(method, route), expected, `${method} ${route}`)
  }
})
