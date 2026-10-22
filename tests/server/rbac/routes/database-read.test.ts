/**
 * S3-B4-1 验收测试：database / fix-sequence 域接线（3 只读诊断 + 3 写操作）。
 *
 * 关键裁决：只读诊断与现状 verifyAdminAuth（ADMIN）等价 → system_settings.read；
 * cleanup / fix-sequence / reset 三个写操作统一 database.reset（SUPER_ADMIN）—— 本批已批准的收紧。
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

const ROUTES: Array<{
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
}> = [
  { file: 'server/api/admin/database/status.get.ts', method: 'GET', route: '/api/admin/database/status', permission: 'system_settings.read', policy: 'canReadSystemSettings' },
  { file: 'server/api/admin/database/pool-status.get.ts', method: 'GET', route: '/api/admin/database/pool-status', permission: 'system_settings.read', policy: 'canReadSystemSettings' },
  { file: 'server/api/admin/database/performance.get.ts', method: 'GET', route: '/api/admin/database/performance', permission: 'system_settings.read', policy: 'canReadSystemSettings' },
  { file: 'server/api/admin/database/reset.post.ts', method: 'POST', route: '/api/admin/database/reset', permission: 'database.reset', policy: 'canResetDatabase' },
  { file: 'server/api/admin/database/cleanup.post.ts', method: 'POST', route: '/api/admin/database/cleanup', permission: 'database.reset', policy: 'canResetDatabase' },
  { file: 'server/api/admin/fix-sequence.post.ts', method: 'POST', route: '/api/admin/fix-sequence', permission: 'database.reset', policy: 'canResetDatabase' }
]

const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const

function createEvent(role: string) {
  return { context: { user: { id: 99, role, status: 'active' } } } as unknown as Parameters<typeof requirePermission>[0]
}

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

test('S3-B4-1 路由 → 权限：database / fix-sequence 域 6 个端点的登记值与具名策略一致', () => {
  for (const item of ROUTES) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.ok(text.includes(`await ${item.policy}(event)`), `${item.file} 必须通过 await ${item.policy}(event) 接线`)
    assert.equal(text.includes('verifyAdminAuth'), false, `${item.file} 仍在使用旧式 verifyAdminAuth`)
  }
})

test('S3-B4-1 4 角色拒绝矩阵：只读诊断 ADMIN 及以上，写操作仅 SUPER_ADMIN', async () => {
  const expected: Record<string, { read: boolean; reset: boolean }> = {
    USER: { read: false, reset: false },
    SONG_ADMIN: { read: false, reset: false },
    ADMIN: { read: true, reset: false },
    SUPER_ADMIN: { read: true, reset: true }
  }

  for (const role of ROLES) {
    assert.equal(await allowedForRole(role, 'system_settings.read'), expected[role].read, `${role} × system_settings.read`)
    assert.equal(await allowedForRole(role, 'database.reset'), expected[role].reset, `${role} × database.reset`)
  }
})

test('S3-B4-1 守卫必须在 try 之外：401/403 不得被 catch 改写成 500', () => {
  for (const item of ROUTES) {
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    // 只在 handler 体内定位：文件顶部的辅助函数（如 fix-sequence 的 fixTableSequence）自带 try，不能算进来
    const handlerStart = text.indexOf('export default defineEventHandler')
    assert.ok(handlerStart >= 0, `${item.file} 未找到 handler`)
    const handlerText = text.slice(handlerStart)
    const guardIndex = handlerText.indexOf(`await ${item.policy}(event)`)
    const tryIndex = handlerText.indexOf('try {')
    assert.ok(guardIndex >= 0, `${item.file} 未找到守卫调用`)
    if (tryIndex >= 0) {
      assert.ok(guardIndex < tryIndex, `${item.file} 的守卫位于 try 内，401/403 会被 catch 转成 500`)
    }
  }
})

test('S3-B4-1 静态接线：文件内已无角色字面量数组 / 裸 .role 比较 / 直读 context.user', () => {
  for (const item of ROUTES) {
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${item.file} 仍有 .role 比较`)
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${item.file} 仍有角色字面量数组`
    )
    assert.equal(/context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user（应走 guard）`)
  }
})
