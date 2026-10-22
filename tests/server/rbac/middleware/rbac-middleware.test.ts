/**
 * S5-4 单测：RBAC 运行时门禁的判定依据（三态矩阵 / 四角色拒绝矩阵 / 反证）。
 *
 * 中间件自身依赖 Nitro 全局（defineEventHandler / getRequestURL），不可直接 import；
 * 本用例把它依赖的两件事钉死：
 *   1. `classifyApiRoute` 的判定（中间件按它分派）；
 *   2. `requirePermission` 的角色矩阵（中间件对 /api/admin/** 的放行/拒绝结论）。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ROUTE_RULES,
  classifyApiRoute
} from '../../../../server/utils/rbac/routePermissionMap.ts'
import { requirePermission } from '../../../../server/utils/rbac/guards.ts'
import { mergePermissionState } from '../../../../server/utils/rbac/resolvePermissions.ts'
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from '../../../../server/utils/rbac/constants.ts'
import type { PermissionKey } from '../../../../server/utils/rbac/constants.ts'

type FakeError = { statusCode?: number; statusMessage?: string; message?: string }

/** 四档角色：权限集合由 catalog 的角色矩阵派生（不连真实 DB） */
const ROLE_TIERS = [ROLES.USER, ROLES.SONG_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN] as const

function createEvent(role: string) {
  return {
    context: { user: { id: 7, role, status: 'active' } }
  } as unknown as Parameters<typeof requirePermission>[0]
}

function depsFor(role: string) {
  return {
    resolveState: async () =>
      mergePermissionState({ roleKeys: [...ROLE_PERMISSIONS[role]], grants: [], matrixRowCount: 1 })
  }
}

async function capture(fn: () => Promise<unknown>): Promise<FakeError | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error as FakeError
  }
}

test('S5-4 三态矩阵：classifyApiRoute 对代表性路径的判定', () => {
  assert.deepEqual(classifyApiRoute('GET', '/api/admin/users'), {
    decision: 'permission',
    permission: 'user.read',
    matched: 'admin:user.read'
  })
  assert.deepEqual(classifyApiRoute('POST', '/api/auth/login'), {
    decision: 'public',
    permission: null,
    matched: 'public'
  })
  assert.deepEqual(classifyApiRoute('GET', '/api/songs'), {
    decision: 'login',
    permission: null,
    matched: 'login'
  })
  assert.deepEqual(classifyApiRoute('GET', '/api/admin/does-not-exist'), {
    decision: 'unmapped',
    permission: null,
    matched: null
  })
  assert.deepEqual(classifyApiRoute('GET', '/api/open/card-codes'), {
    decision: 'permission',
    permission: 'card_codes.read',
    matched: 'open:card_codes.read'
  })
})

test('S5-4 拒绝矩阵：USER / SONG_ADMIN / ADMIN / SUPER_ADMIN 四档', async () => {
  const expectations: Array<[string, PermissionKey, boolean]> = [
    [ROLES.USER, PERMISSIONS.SONG_READ, false],
    [ROLES.USER, PERMISSIONS.USER_READ, false],
    [ROLES.USER, PERMISSIONS.DATABASE_RESET, false],
    [ROLES.SONG_ADMIN, PERMISSIONS.SONG_READ, true],
    [ROLES.SONG_ADMIN, PERMISSIONS.USER_READ, false],
    [ROLES.SONG_ADMIN, PERMISSIONS.DATABASE_RESET, false],
    [ROLES.ADMIN, PERMISSIONS.USER_READ, true],
    [ROLES.ADMIN, PERMISSIONS.DATABASE_RESET, false],
    [ROLES.SUPER_ADMIN, PERMISSIONS.USER_READ, true],
    [ROLES.SUPER_ADMIN, PERMISSIONS.DATABASE_RESET, true]
  ]

  for (const [role, key, allowed] of expectations) {
    const error = await capture(() => requirePermission(createEvent(role), key, depsFor(role)))
    if (allowed) {
      assert.equal(error, null, `${role} 应当拥有 ${key}`)
    } else {
      assert.equal(error?.statusCode, 403, `${role} 访问 ${key} 应 403`)
      assert.equal(error?.statusMessage, 'COMMON_INSUFFICIENT_PERMISSION')
    }
  }

  // 四档角色集合确实互不相同（否则上面的矩阵是自证）
  assert.deepEqual(
    ROLE_TIERS.map((role) => ROLE_PERMISSIONS[role].length),
    [0, 12, 22, 35]
  )
})

test('S5-4 未登录：/api/admin/** 的权限判定返回 401（先于角色矩阵）', async () => {
  const unauthenticated = {
    context: {}
  } as unknown as Parameters<typeof requirePermission>[0]
  const error = await capture(() =>
    requirePermission(unauthenticated, PERMISSIONS.USER_READ, {
      resolveState: async () =>
        mergePermissionState({ roleKeys: [...ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]], grants: [], matrixRowCount: 1 })
    })
  )
  assert.equal(error?.statusCode, 401)
  assert.equal(error?.statusMessage, 'AUTH_UNAUTHORIZED')
})

test('S5-4 反证：临时删掉一条 admin 规则后该路径变为 unmapped（等价于运行时 403）', () => {
  const index = ROUTE_RULES.findIndex(
    (rule) => rule.method === 'ANY' && rule.pattern.test('/api/admin/blacklist')
  )
  assert.ok(index >= 0, '未找到 /api/admin/blacklist 的规则，反证无法进行')

  const rule = ROUTE_RULES[index]!
  const originalPattern = rule.pattern
  try {
    assert.equal(classifyApiRoute('GET', '/api/admin/blacklist').decision, 'permission')
    rule.pattern = /^\/api\/admin\/__never_matches__$/
    assert.deepEqual(classifyApiRoute('GET', '/api/admin/blacklist'), {
      decision: 'unmapped',
      permission: null,
      matched: null
    })
  } finally {
    rule.pattern = originalPattern
  }

  assert.equal(classifyApiRoute('GET', '/api/admin/blacklist').decision, 'permission')
})
