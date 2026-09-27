/**
 * S2-2 单测：legacy 回滚路径（RBAC_ENABLED=false）与「空矩阵降级」的等价性（D6 / F-08 / R-25）。
 *
 * 核心断言：legacy 语义完全由 catalog 派生（`roleHasPermission`），不存在第二份 minRole 表；
 * 且「seed 未就位 ⇒ degraded 兜底」与「RBAC_ENABLED=false」对同一 (角色, 权限) 输入结果一致。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  legacyRoleHasPermission,
  requireLegacyAnyRoleCheck,
  requireLegacyRoleCheck
} from '../../../../server/utils/rbac/legacyRoleCheck.ts'
import { requirePermission } from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import { PERMISSION_KEYS, ROLE_ORDER, type PermissionKey } from '../../../../server/utils/rbac/constants.ts'

type FakeError = { statusCode?: number; statusMessage?: string; message?: string }

function createEvent(user: { id: number; role?: string | null; status?: string | null } | undefined) {
  return { context: { user } } as unknown as Parameters<typeof requireLegacyRoleCheck>[0]
}

async function capture(fn: () => Promise<unknown>): Promise<FakeError | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error as FakeError
  }
}

test('S2-2 legacy 判定：与 catalog minRole 完全一致（含 D10：ADMIN 无 permissions.read）', () => {
  assert.equal(legacyRoleHasPermission('USER', 'song.read' as PermissionKey), false)
  assert.equal(legacyRoleHasPermission('SONG_ADMIN', 'song.read' as PermissionKey), true)
  assert.equal(legacyRoleHasPermission('SONG_ADMIN', 'user.read' as PermissionKey), false)
  assert.equal(legacyRoleHasPermission('ADMIN', 'user.read' as PermissionKey), true)
  assert.equal(legacyRoleHasPermission('ADMIN', 'permissions.read' as PermissionKey), false)
  assert.equal(legacyRoleHasPermission('SUPER_ADMIN', 'permissions.read' as PermissionKey), true)
  assert.equal(legacyRoleHasPermission(null, 'song.read' as PermissionKey), false)
  assert.equal(legacyRoleHasPermission('UNKNOWN_ROLE', 'song.read' as PermissionKey), false)
  // 未知 key 一律拒绝（禁止 fail-open）
  assert.equal(legacyRoleHasPermission('SUPER_ADMIN', 'songs.read' as PermissionKey), false)
})

test('S2-2 legacy 覆盖矩阵：全 35 key × 4 角色的判定可枚举且稳定', () => {
  const snapshot = ROLE_ORDER.map((role) => [role, PERMISSION_KEYS.filter((key) => legacyRoleHasPermission(role, key)).length])
  assert.deepEqual(snapshot, [
    ['USER', 0],
    ['SONG_ADMIN', 12],
    ['ADMIN', 25],
    ['SUPER_ADMIN', 35]
  ])
})

test('S2-2 requireLegacyRoleCheck：401 / 403-账号异常 / 403-缺权限', async () => {
  const anonymous = await capture(() => requireLegacyRoleCheck(createEvent(undefined), 'song.read' as PermissionKey))
  assert.equal(anonymous?.statusCode, 401)

  const unavailable = await capture(() =>
    requireLegacyRoleCheck(createEvent({ id: 1, role: 'ADMIN', status: 'frozen' }), 'song.read' as PermissionKey)
  )
  assert.equal(unavailable?.statusMessage, 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE')

  const missing = await capture(() =>
    requireLegacyRoleCheck(createEvent({ id: 2, role: 'USER', status: 'active' }), 'song.read' as PermissionKey)
  )
  assert.equal(missing?.statusCode, 403)
  assert.match(missing?.message ?? '', /缺少权限：song\.read/)
})

test('S2-2 requireLegacyAnyRoleCheck：任一满足即放行', async () => {
  const ok = await requireLegacyAnyRoleCheck(
    createEvent({ id: 3, role: 'SONG_ADMIN', status: 'active' }),
    ['user.read', 'song.read'] as PermissionKey[]
  )
  assert.equal(ok.id, 3)

  const denied = await capture(() =>
    requireLegacyAnyRoleCheck(createEvent({ id: 4, role: 'USER', status: 'active' }), ['user.read', 'song.read'] as PermissionKey[])
  )
  assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
})

test('S2-2 F-08 等价性：空矩阵降级（degraded）与 RBAC_ENABLED=false 逐条同结果', async () => {
  const keys: PermissionKey[] = ['song.read', 'user.read', 'permissions.read', 'database.reset']
  const roles = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']
  const degradedDeps = {
    resolveState: async () => mergePermissionState({ roleKeys: [], grants: [], matrixRowCount: 0 }),
    onDegraded: () => {}
  }

  for (const role of roles) {
    for (const key of keys) {
      const event = createEvent({ id: 100, role, status: 'active' })
      const degraded = await capture(() => requirePermission(event, key, degradedDeps))

      const original = process.env.RBAC_ENABLED
      process.env.RBAC_ENABLED = 'false'
      let legacyResult: FakeError | null
      try {
        legacyResult = await capture(() => requirePermission(createEvent({ id: 100, role, status: 'active' }), key))
      } finally {
        if (original === undefined) delete process.env.RBAC_ENABLED
        else process.env.RBAC_ENABLED = original
      }

      assert.equal(
        degraded === null,
        legacyResult === null,
        `降级与开关关闭结果不一致：${role} × ${key}（degraded=${degraded?.message ?? 'pass'}，legacy=${legacyResult?.message ?? 'pass'}）`
      )
    }
  }
})
