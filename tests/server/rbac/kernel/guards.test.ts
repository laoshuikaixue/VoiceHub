/**
 * S2-2 单测：guards 三态 / legacy 分叉（R-25）/ 降级 fail-open（D6 / F-08）/ 白名单函数。
 *
 * 依赖注入说明：`requirePermission` / `requireAnyPermission` 的第三个参数仅供测试注入权限来源，
 * 生产代码只传前两个参数（内部走 DB + 缓存）。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractUserIdentity,
  getUserRole,
  isAdminRole,
  isSongAdminRole,
  isSuperAdmin,
  requireAnyPermission,
  requirePermission,
  requireSuperAdmin
} from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import type { PermissionKey } from '../../../../server/utils/rbac/constants.ts'

type FakeError = { statusCode?: number; statusMessage?: string; data?: { code?: string }; message?: string }

function createEvent(user: { id: number; role?: string | null; status?: string | null } | undefined) {
  return { context: { user } } as unknown as Parameters<typeof requirePermission>[0]
}

async function capture(fn: () => Promise<unknown>): Promise<FakeError | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error as FakeError
  }
}

const active = { id: 42, role: 'ADMIN', status: 'active' }

function resolveWith(keys: string[], matrixRowCount = 1) {
  return async () => mergePermissionState({ roleKeys: keys, grants: [], matrixRowCount })
}

function resolveDegraded() {
  return async () => mergePermissionState({ roleKeys: [], grants: [], matrixRowCount: 0 })
}

test('S2-2 requirePermission 三态：401 / 403-账号异常 / 403-缺权限', async () => {
  const unauthenticated = await capture(() =>
    requirePermission(createEvent(undefined), 'user.read' as PermissionKey, { resolveState: resolveWith(['user.read']) })
  )
  assert.equal(unauthenticated?.statusCode, 401)
  assert.equal(unauthenticated?.statusMessage, 'AUTH_UNAUTHORIZED')

  const unavailable = await capture(() =>
    requirePermission(createEvent({ ...active, status: 'banned' }), 'user.read' as PermissionKey, {
      resolveState: resolveWith(['user.read'])
    })
  )
  assert.equal(unavailable?.statusCode, 403)
  assert.equal(unavailable?.statusMessage, 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE')

  const missing = await capture(() =>
    requirePermission(createEvent(active), 'user.read' as PermissionKey, { resolveState: resolveWith([]) })
  )
  assert.equal(missing?.statusCode, 403)
  assert.equal(missing?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
  assert.match(missing?.message ?? '', /缺少权限：user\.read/)
})

test('S2-2 requirePermission：有权限时放行并返回该用户', async () => {
  const user = await requirePermission(createEvent(active), 'user.read' as PermissionKey, {
    resolveState: resolveWith(['user.read'])
  })
  assert.equal(user.id, 42)
})

test('S2-2 requirePermission：catalog 之外的 key 一律拒绝（禁止 fail-open）', async () => {
  let resolved = false
  const error = await capture(() =>
    requirePermission(createEvent(active), 'songs.read' as PermissionKey, {
      resolveState: async () => {
        resolved = true
        return mergePermissionState({ roleKeys: [], grants: [], matrixRowCount: 1 })
      }
    })
  )
  assert.equal(error?.statusCode, 403)
  assert.equal(resolved, false, '未知 key 不应触发权限解析')
})

test('S2-2 RBAC_ENABLED=false：requirePermission 走 legacy 且不查库（R-25）', async () => {
  const original = process.env.RBAC_ENABLED
  process.env.RBAC_ENABLED = 'false'
  try {
    let resolved = false
    const deps = {
      resolveState: async () => {
        resolved = true
        return mergePermissionState({ roleKeys: [], grants: [], matrixRowCount: 0 })
      }
    }

    // catalog 中 user.read 的 minRole = ADMIN
    const allowed = await requirePermission(
      createEvent({ id: 1, role: 'ADMIN', status: 'active' }),
      'user.read' as PermissionKey,
      deps
    )
    assert.equal(allowed.id, 1)

    const denied = await capture(() =>
      requirePermission(createEvent({ id: 2, role: 'SONG_ADMIN', status: 'active' }), 'user.read' as PermissionKey, deps)
    )
    assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
    assert.equal(resolved, false, 'legacy 路径不得查库')
  } finally {
    if (original === undefined) delete process.env.RBAC_ENABLED
    else process.env.RBAC_ENABLED = original
  }
})

test('S2-2 RBAC_ENABLED=false：requireAnyPermission 同样走 legacy（上一轮漏掉的 R-25）', async () => {
  const original = process.env.RBAC_ENABLED
  process.env.RBAC_ENABLED = 'false'
  try {
    // SONG_ADMIN 有 song.read、没有 user.read；若这里没分叉，就会走注入的空集合 → 403（用例失败）
    const user = await requireAnyPermission(
      createEvent({ id: 3, role: 'SONG_ADMIN', status: 'active' }),
      ['user.read', 'song.read'] as PermissionKey[],
      { resolveState: resolveWith([]) }
    )
    assert.equal(user.id, 3)

    const denied = await capture(() =>
      requireAnyPermission(
        createEvent({ id: 4, role: 'USER', status: 'active' }),
        ['user.read', 'song.read'] as PermissionKey[],
        { resolveState: resolveWith([]) }
      )
    )
    assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
  } finally {
    if (original === undefined) delete process.env.RBAC_ENABLED
    else process.env.RBAC_ENABLED = original
  }
})

test('S2-2 空矩阵降级：按 catalog minRole 兜底并触发 degraded 日志（seed 未就位不得全员 403）', async () => {
  const degradedReasons: string[] = []
  const deps = {
    resolveState: resolveDegraded(),
    onDegraded: (state: { degradedReason: string | null }) => degradedReasons.push(state.degradedReason ?? '')
  }

  const superAdmin = await requirePermission(
    createEvent({ id: 9, role: 'SUPER_ADMIN', status: 'active' }),
    'permissions.read' as PermissionKey,
    deps
  )
  assert.equal(superAdmin.id, 9)
  assert.equal(degradedReasons.length, 1)
  assert.match(degradedReasons[0] ?? '', /role_permissions 表为空/)

  const userDenied = await capture(() =>
    requirePermission(createEvent({ id: 10, role: 'USER', status: 'active' }), 'user.read' as PermissionKey, deps)
  )
  assert.equal(userDenied?.statusCode, 403)
})

test('S2-2 requireAnyPermission（新路径）：命中任一即放行，全不命中拒绝', async () => {
  const allowed = await requireAnyPermission(createEvent(active), ['song.read', 'user.read'] as PermissionKey[], {
    resolveState: resolveWith(['user.read'])
  })
  assert.equal(allowed.id, 42)

  const denied = await capture(() =>
    requireAnyPermission(createEvent(active), ['song.read', 'schedule.read'] as PermissionKey[], {
      resolveState: resolveWith(['user.read'])
    })
  )
  assert.equal(denied?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
  assert.match(denied?.message ?? '', /缺少任一权限/)

  const allUnknown = await capture(() =>
    requireAnyPermission(createEvent(active), ['songs.read'] as PermissionKey[], { resolveState: resolveWith(['user.read']) })
  )
  assert.equal(allUnknown?.statusCode, 403)
})

test('S2-2 requireSuperAdmin：仅 SUPER_ADMIN 可过', async () => {
  const ok = await requireSuperAdmin(createEvent({ id: 5, role: 'SUPER_ADMIN', status: 'active' }))
  assert.equal(ok.id, 5)

  const denied = await capture(() => requireSuperAdmin(createEvent({ id: 6, role: 'ADMIN', status: 'active' })))
  assert.equal(denied?.statusCode, 403)
  assert.match(denied?.message ?? '', /仅超级管理员/)

  const anonymous = await capture(() => requireSuperAdmin(createEvent(undefined)))
  assert.equal(anonymous?.statusCode, 401)
})

test('S2-2 白名单函数：同时接受用户对象与 role 字符串', () => {
  assert.equal(isSuperAdmin({ role: 'SUPER_ADMIN' }), true)
  assert.equal(isSuperAdmin('SUPER_ADMIN'), true)
  assert.equal(isSuperAdmin({ role: 'ADMIN' }), false)
  assert.equal(isAdminRole({ role: 'ADMIN' }), true)
  assert.equal(isAdminRole('SUPER_ADMIN'), true)
  assert.equal(isAdminRole('SONG_ADMIN'), false)
  assert.equal(isSongAdminRole({ role: 'SONG_ADMIN' }), true)
  assert.equal(isSongAdminRole('ADMIN'), true)
  assert.equal(isSongAdminRole('USER'), false)
  assert.equal(getUserRole({ role: 'ADMIN' }), 'ADMIN')
  assert.equal(getUserRole('SONG_ADMIN'), 'SONG_ADMIN')
  assert.equal(getUserRole(undefined), undefined)

  const identity = extractUserIdentity({ id: 1, username: 'u', name: 'n', role: 'ADMIN', email: 'a@b.c' })
  assert.deepEqual(Object.keys(identity).sort(), [
    'class',
    'email',
    'emailVerified',
    'forcePasswordChange',
    'grade',
    'id',
    'name',
    'passwordChangedAt',
    'role',
    'username'
  ])
  assert.equal(identity.role, 'ADMIN')
})
