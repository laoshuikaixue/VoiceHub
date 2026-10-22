/**
 * S3-B4-1 验收测试：system-settings 域接线（读 2 文件 + 写 3 文件）。
 *
 * 三层断言：
 *   1. **路由 → 权限**：读端点登记 system_settings.read、写端点登记 system_settings.write；
 *   2. **4 角色矩阵**：读 = ADMIN 及以上；写 = 仅 SUPER_ADMIN（本批已批准的收紧）；
 *   3. **静态接线**：文件内不得再出现内联角色数组 / 裸 .role 比较，且必须走具名策略。
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

type RouteCase = {
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
}

const ROUTES: RouteCase[] = [
  { file: 'server/api/admin/system-settings/index.ts', method: 'GET', route: '/api/admin/system-settings', permission: 'system_settings.read', policy: 'canReadSystemSettings' },
  { file: 'server/api/admin/system-settings/env-oauth.get.ts', method: 'GET', route: '/api/admin/system-settings/env-oauth', permission: 'system_settings.read', policy: 'canReadSystemSettings' },
  { file: 'server/api/admin/db-status.get.ts', method: 'GET', route: '/api/admin/db-status', permission: 'system_settings.read', policy: 'canReadSystemSettings' },
  { file: 'server/api/admin/system-settings/index.post.ts', method: 'POST', route: '/api/admin/system-settings', permission: 'system_settings.write', policy: 'canWriteSystemSettings' },
  { file: 'server/api/admin/system-settings/env-oauth-import.post.ts', method: 'POST', route: '/api/admin/system-settings/env-oauth-import', permission: 'system_settings.write', policy: 'canWriteSystemSettings' },
  { file: 'server/api/admin/system-settings/clear-aggregate-bindings.post.ts', method: 'POST', route: '/api/admin/system-settings/clear-aggregate-bindings', permission: 'system_settings.write', policy: 'canWriteSystemSettings' }
]

/** 静态清零检查适用的文件：index.post.ts 保留 event.context.user 供主题分支使用，单独排除 */
const STATIC_FILES = ROUTES.filter((item) => item.file !== 'server/api/admin/system-settings/index.post.ts')

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

test('S3-B4-1 路由 → 权限：system-settings 域 6 个端点的登记值与具名策略一致', () => {
  for (const item of ROUTES) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.ok(text.includes(`await ${item.policy}(event)`), `${item.file} 必须通过 await ${item.policy}(event) 接线`)
    assert.equal(text.includes('verifyAdminAuth'), false, `${item.file} 仍在使用旧式 verifyAdminAuth`)
  }
})

test('S3-B4-1 4 角色拒绝矩阵：读 = ADMIN 及以上，写 = 仅 SUPER_ADMIN', async () => {
  const expected: Record<string, { read: boolean; write: boolean }> = {
    USER: { read: false, write: false },
    SONG_ADMIN: { read: false, write: false },
    ADMIN: { read: true, write: false },
    SUPER_ADMIN: { read: true, write: true }
  }

  for (const role of ROLES) {
    assert.equal(await allowedForRole(role, 'system_settings.read'), expected[role].read, `${role} × system_settings.read`)
    assert.equal(await allowedForRole(role, 'system_settings.write'), expected[role].write, `${role} × system_settings.write`)
  }
})

test('S3-B4-1 未登录 401 / 账号异常 403（三态收敛到 guard）', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(anonymous, 'system_settings.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number }) => error.statusCode === 401
  )

  const frozen = {
    context: { user: { id: 1, role: 'ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, 'system_settings.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )
})

test('S3-B4-1 静态接线：文件内已无角色字面量数组 / 裸 .role 比较 / 直读 context.user', () => {
  for (const item of STATIC_FILES) {
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${item.file} 仍有 .role 比较`)
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${item.file} 仍有角色字面量数组`
    )
    assert.equal(/context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user（应走 guard）`)
  }

  // 主题分支是唯一保留的角色分支：必须走内核白名单函数，不得裸读 .role
  const writeText = fs.readFileSync(path.join(ROOT, 'server/api/admin/system-settings/index.post.ts'), 'utf8')
  assert.ok(writeText.includes('isSuperAdmin(user)'), '主题分支必须使用内核白名单函数 isSuperAdmin(user)')
  assert.equal(/\.role\s*(===|!==)/.test(writeText), false, 'index.post.ts 仍有 .role 比较')
})
