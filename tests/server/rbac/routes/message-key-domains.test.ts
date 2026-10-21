/**
 * S3 批次 D 验收测试：消息与密钥域接线（18 个端点 / 4 个目录）。
 *
 * 三层断言：
 *   1. **路由 → 权限**：18 个端点在 routePermissionMap 里的登记值与具名策略一致；
 *   2. **4 角色拒绝矩阵**：用 catalog 派生的权限集驱动 `requirePermission`（等价于 seed 后的
 *      `role_permissions`），逐条断言 USER / SONG_ADMIN / ADMIN / SUPER_ADMIN 的放行与拒绝；
 *   3. **静态接线 + 护栏**：文件里不得再有内联角色数组 / 裸 `.role` / 直读 `context.user`；
 *      守卫必须留在 try 之外（放进 try 又不原样抛出会把 401/403 吞成 500）。
 *
 * 有意行为变更（记此备查）：api-keys 六个端点旧实现在未登录时抛 403，收敛到 guard 后为 401；
 * 其余 12 个端点三态与旧实现逐条等价。
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

type RouteItem = {
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
}

/** 批次 D 的 18 个端点 → 期望权限与具名策略 */
const ROUTES: RouteItem[] = [
  // notifications → notification.send（minRole ADMIN，与旧 canSendSystemNotification 等价）
  { file: 'server/api/admin/notifications/send.post.ts', method: 'POST', route: '/api/admin/notifications/send', permission: 'notification.send', policy: 'canSendNotifications' },
  { file: 'server/api/admin/notifications/history.get.ts', method: 'GET', route: '/api/admin/notifications/history', permission: 'notification.send', policy: 'canSendNotifications' },
  { file: 'server/api/admin/notifications/history/[batchId].get.ts', method: 'GET', route: '/api/admin/notifications/history/batch-1', permission: 'notification.send', policy: 'canSendNotifications' },
  { file: 'server/api/admin/notifications/history/[batchId].put.ts', method: 'PUT', route: '/api/admin/notifications/history/batch-1', permission: 'notification.send', policy: 'canSendNotifications' },
  { file: 'server/api/admin/notifications/history/[batchId].delete.ts', method: 'DELETE', route: '/api/admin/notifications/history/batch-1', permission: 'notification.send', policy: 'canSendNotifications' },
  // email-templates → email_templates.manage（minRole ADMIN，与旧 ['ADMIN','SUPER_ADMIN'] 等价）
  { file: 'server/api/admin/email-templates/index.get.ts', method: 'GET', route: '/api/admin/email-templates', permission: 'email_templates.manage', policy: 'canManageEmailTemplates' },
  { file: 'server/api/admin/email-templates/index.post.ts', method: 'POST', route: '/api/admin/email-templates', permission: 'email_templates.manage', policy: 'canManageEmailTemplates' },
  { file: 'server/api/admin/email-templates/index.delete.ts', method: 'DELETE', route: '/api/admin/email-templates', permission: 'email_templates.manage', policy: 'canManageEmailTemplates' },
  { file: 'server/api/admin/email-templates/preview.post.ts', method: 'POST', route: '/api/admin/email-templates/preview', permission: 'email_templates.manage', policy: 'canManageEmailTemplates' },
  // smtp → smtp.manage（minRole ADMIN）
  { file: 'server/api/admin/smtp/reload.post.ts', method: 'POST', route: '/api/admin/smtp/reload', permission: 'smtp.manage', policy: 'canManageSmtp' },
  { file: 'server/api/admin/smtp/test-connection.post.ts', method: 'POST', route: '/api/admin/smtp/test-connection', permission: 'smtp.manage', policy: 'canManageSmtp' },
  { file: 'server/api/admin/smtp/test-email.post.ts', method: 'POST', route: '/api/admin/smtp/test-email', permission: 'smtp.manage', policy: 'canManageSmtp' },
  // api-keys → read / write / delete（三条 minRole 均 SUPER_ADMIN，与旧 role !== 'SUPER_ADMIN' 等价）
  { file: 'server/api/admin/api-keys/index.get.ts', method: 'GET', route: '/api/admin/api-keys', permission: 'api_keys.read', policy: 'canReadApiKeys' },
  { file: 'server/api/admin/api-keys/[id].get.ts', method: 'GET', route: '/api/admin/api-keys/1', permission: 'api_keys.read', policy: 'canReadApiKeys' },
  { file: 'server/api/admin/api-keys/logs.get.ts', method: 'GET', route: '/api/admin/api-keys/logs', permission: 'api_keys.read', policy: 'canReadApiKeys' },
  { file: 'server/api/admin/api-keys/index.post.ts', method: 'POST', route: '/api/admin/api-keys', permission: 'api_keys.write', policy: 'canWriteApiKeys' },
  { file: 'server/api/admin/api-keys/[id].put.ts', method: 'PUT', route: '/api/admin/api-keys/1', permission: 'api_keys.write', policy: 'canWriteApiKeys' },
  { file: 'server/api/admin/api-keys/[id].delete.ts', method: 'DELETE', route: '/api/admin/api-keys/1', permission: 'api_keys.delete', policy: 'canDeleteApiKeys' }
]

const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const

const EXPECTED: Record<string, Record<string, boolean>> = {
  USER: { 'notification.send': false, 'email_templates.manage': false, 'smtp.manage': false, 'api_keys.read': false, 'api_keys.write': false, 'api_keys.delete': false },
  SONG_ADMIN: { 'notification.send': false, 'email_templates.manage': false, 'smtp.manage': false, 'api_keys.read': false, 'api_keys.write': false, 'api_keys.delete': false },
  ADMIN: { 'notification.send': true, 'email_templates.manage': true, 'smtp.manage': true, 'api_keys.read': false, 'api_keys.write': false, 'api_keys.delete': false },
  SUPER_ADMIN: { 'notification.send': true, 'email_templates.manage': true, 'smtp.manage': true, 'api_keys.read': true, 'api_keys.write': true, 'api_keys.delete': true }
}

const PERMISSIONS: PermissionKey[] = [
  'notification.send',
  'email_templates.manage',
  'smtp.manage',
  'api_keys.read',
  'api_keys.write',
  'api_keys.delete'
]

const readRoute = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

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

test('批次 D 路由 → 权限：18 个端点的登记值与具名策略一致', () => {
  for (const item of ROUTES) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
    const text = readRoute(item.file)
    assert.ok(text.includes(`${item.policy}(event)`), `${item.file} 必须通过 ${item.policy}(event) 接线`)
  }
})

test('批次 D 4 角色拒绝矩阵：六个权限的放行与拒绝符合预期', async () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      assert.equal(await allowedForRole(role, permission), EXPECTED[role][permission], `${role} × ${permission}`)
    }
  }
})

test('批次 D 三态收敛：未登录 401 / 账号异常 403 / 缺权限 403', async () => {
  const anonymous = { context: {} } as unknown as Parameters<typeof requirePermission>[0]
  for (const permission of PERMISSIONS) {
    await assert.rejects(
      () => requirePermission(anonymous, permission, { resolveState: resolveForRole('SUPER_ADMIN') }),
      (error: { statusCode?: number }) => error.statusCode === 401,
      `${permission} 未登录应为 401`
    )
  }

  const frozen = {
    context: { user: { id: 1, role: 'SUPER_ADMIN', status: 'frozen' } }
  } as unknown as Parameters<typeof requirePermission>[0]
  await assert.rejects(
    () => requirePermission(frozen, 'notification.send', { resolveState: resolveForRole('SUPER_ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE'
  )

  // api-keys 旧实现在未登录时抛 403，收敛到 guard 后统一为 401（有意行为变更，见文件头说明）
  const admin = createEvent('ADMIN')
  await assert.rejects(
    () => requirePermission(admin, 'api_keys.read', { resolveState: resolveForRole('ADMIN') }),
    (error: { statusCode?: number; statusMessage?: string }) =>
      error.statusCode === 403 && error.statusMessage === 'COMMON_INSUFFICIENT_PERMISSION'
  )
})

test('批次 D 静态接线：18 个文件已无角色比较 / 内联角色数组 / 直读 context.user', () => {
  for (const item of ROUTES) {
    const text = readRoute(item.file)
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${item.file} 仍有 .role 比较`)
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${item.file} 仍有角色字面量数组`
    )
    assert.equal(/context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user（应走 guard）`)
    assert.equal(/canSendSystemNotification/.test(text), false, `${item.file} 仍在调用角色分支谓词 canSendSystemNotification`)
  }
})

test('批次 D 护栏：守卫必须留在 try 之外（否则 401/403 会被吞成 500）', () => {
  for (const item of ROUTES) {
    const text = readRoute(item.file)
    const handlerStart = text.indexOf('defineEventHandler')
    const guardCall = text.indexOf(`${item.policy}(event)`)
    assert.ok(handlerStart >= 0 && guardCall > handlerStart, `${item.file} 未找到守卫调用点`)
    const guardRegion = text.slice(handlerStart, guardCall)
    assert.equal(/try\s*\{/.test(guardRegion), false, `${item.file} 的守卫落在 try 内`)
  }
})

test('批次 D 辅助模块保持不动：api-keys/permissions.ts 无路由导出', () => {
  const text = readRoute('server/api/admin/api-keys/permissions.ts')
  assert.equal(/defineEventHandler/.test(text), false, 'permissions.ts 是辅助模块，不得含 defineEventHandler')
  assert.ok(text.includes('apiPermissionSchema'), 'permissions.ts 应保留 apiPermissionSchema 导出')
})
