/**
 * S3-B1 单测：具名策略（S3-B1 · D8）。
 *
 * 覆盖三块：
 *   1. **客体策略**：ADMIN 对 SUPER_ADMIN 目标一律拒绝；且**与 `RBAC_ENABLED` 无关**（边界警告）；
 *   2. **主体策略**：薄封装 `requirePermission`（用注入的权限来源验证，不碰 DB）；
 *   3. **个人集成默认策略**：形态集合来自 catalog，归一化判定覆盖 legacy 与点分写法。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PERSONAL_INTEGRATION_PERMISSION,
  PERSONAL_INTEGRATION_PERMISSION_FORMS,
  PERSONAL_INTEGRATION_PERMISSION_STORED,
  assertCanAssignRole,
  assertCanMutateTarget,
  canAssignRole,
  canManageUsers,
  canMutateTarget,
  canSeeAdminFields,
  isPersonalIntegrationPermission
} from '../../../../server/utils/rbac/policies.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'

type FakeError = { statusCode?: number; statusMessage?: string; message?: string }

function createEvent(user: { id: number; role?: string | null; status?: string | null } | undefined) {
  return { context: { user } } as unknown as Parameters<typeof assertCanMutateTarget>[0]
}

async function capture(fn: () => Promise<unknown> | unknown): Promise<FakeError | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error as FakeError
  }
}

test('S3-B1 客体策略 canMutateTarget：ADMIN 不能操作 SUPER_ADMIN，其余沿用旧语义', () => {
  assert.equal(canMutateTarget({ role: 'ADMIN' }, { role: 'SUPER_ADMIN' }), false)
  assert.equal(canMutateTarget({ role: 'SONG_ADMIN' }, { role: 'SUPER_ADMIN' }), false)
  assert.equal(canMutateTarget({ role: 'USER' }, { role: 'SUPER_ADMIN' }), false)
  assert.equal(canMutateTarget({ role: 'SUPER_ADMIN' }, { role: 'SUPER_ADMIN' }), true)
  // 非 SUPER_ADMIN 目标：不引入新护栏（ADMIN 之间仍可互操作），避免行为变更
  assert.equal(canMutateTarget({ role: 'ADMIN' }, { role: 'ADMIN' }), true)
  assert.equal(canMutateTarget({ role: 'ADMIN' }, { role: 'USER' }), true)
  assert.equal(canMutateTarget({ role: 'USER' }, { role: 'ADMIN' }), true)
})

test('S3-B1 客体策略 canAssignRole：禁止把他人提权为 SUPER_ADMIN', () => {
  assert.equal(canAssignRole({ role: 'ADMIN' }, 'SUPER_ADMIN'), false)
  assert.equal(canAssignRole({ role: 'SUPER_ADMIN' }, 'SUPER_ADMIN'), true)
  assert.equal(canAssignRole({ role: 'ADMIN' }, 'ADMIN'), true)
  assert.equal(canAssignRole({ role: 'SONG_ADMIN' }, 'USER'), true)
  assert.equal(canAssignRole({ role: 'ADMIN' }, null), true)
})

test('S3-B1 assertCanMutateTarget：未登录 401 / 越权 403', async () => {
  const anonymous = await capture(() => assertCanMutateTarget(createEvent(undefined), { role: 'USER' }))
  assert.equal(anonymous?.statusCode, 401)

  const denied = await capture(() =>
    assertCanMutateTarget(createEvent({ id: 1, role: 'ADMIN', status: 'active' }), { role: 'SUPER_ADMIN' })
  )
  assert.equal(denied?.statusCode, 403)
  assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')

  const allowed = await assertCanMutateTarget(createEvent({ id: 2, role: 'ADMIN', status: 'active' }), { role: 'USER' })
  assert.equal(allowed.id, 2)
})

test('S3-B1 边界警告：客体策略不读 RBAC_ENABLED（关了开关仍必须拒绝）', async () => {
  const original = process.env.RBAC_ENABLED
  process.env.RBAC_ENABLED = 'false'
  try {
    const denied = await capture(() =>
      assertCanMutateTarget(createEvent({ id: 1, role: 'ADMIN', status: 'active' }), { role: 'SUPER_ADMIN' })
    )
    assert.equal(denied?.statusCode, 403, '客体策略与回滚开关无关，必须始终生效')

    const assignDenied = await capture(() =>
      assertCanAssignRole(createEvent({ id: 1, role: 'ADMIN', status: 'active' }), 'SUPER_ADMIN')
    )
    assert.equal(assignDenied?.statusCode, 403)
  } finally {
    if (original === undefined) delete process.env.RBAC_ENABLED
    else process.env.RBAC_ENABLED = original
  }
})

test('S3-B1 canSeeAdminFields：按角色塑形（不抛错）', () => {
  assert.equal(canSeeAdminFields({ role: 'ADMIN' }), true)
  assert.equal(canSeeAdminFields({ role: 'SUPER_ADMIN' }), true)
  assert.equal(canSeeAdminFields({ role: 'SONG_ADMIN' }), false)
  assert.equal(canSeeAdminFields({ role: 'USER' }), false)
  assert.equal(canSeeAdminFields(null), false)
})

test('S3-B1 主体策略是 requirePermission 的薄封装', async () => {
  const event = createEvent({ id: 7, role: 'ADMIN', status: 'active' })
  const granted = await canManageUsers(event, {
    resolveState: async () => mergePermissionState({ roleKeys: ['user.manage'], grants: [], matrixRowCount: 1 })
  })
  assert.equal(granted.id, 7)

  const denied = await capture(() =>
    canManageUsers(event, {
      resolveState: async () => mergePermissionState({ roleKeys: [], grants: [], matrixRowCount: 1 })
    })
  )
  assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
})

test('S3-B1 个人集成策略：形态集合由 catalog 派生，归一化判定覆盖全部写法', () => {
  // ['song.read', 'songs:read', 'songs:request'] —— 顺序无关，只断言集合语义
  assert.equal(PERSONAL_INTEGRATION_PERMISSION_FORMS.length >= 3, true)
  assert.equal(PERSONAL_INTEGRATION_PERMISSION_FORMS.includes(PERSONAL_INTEGRATION_PERMISSION), true)
  assert.equal(PERSONAL_INTEGRATION_PERMISSION_FORMS.includes(PERSONAL_INTEGRATION_PERMISSION_STORED), true)

  for (const value of PERSONAL_INTEGRATION_PERMISSION_FORMS) {
    assert.equal(isPersonalIntegrationPermission(value), true, `应识别为个人集成权限：${value}`)
  }
  assert.equal(isPersonalIntegrationPermission('song.write'), false)
  assert.equal(isPersonalIntegrationPermission('songs:write'), false)

  // 过渡期状态：存储形态仍是 api-auth 认识的 legacy 形；S5-4 统一词表后应改为 catalog key（并同步本用例）
  assert.equal(PERSONAL_INTEGRATION_PERMISSION, 'song.read')
  assert.equal(isPersonalIntegrationPermission(PERSONAL_INTEGRATION_PERMISSION_STORED), true)
})
