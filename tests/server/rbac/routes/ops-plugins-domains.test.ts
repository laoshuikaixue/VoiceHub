/**
 * S3-B4 批次 F 验收测试：system-board / music-source-plugins 域接线。
 *
 * 裁决：
 *   - system-board 三个端点现状 verifyAdminAuth + 文件内 role !== 'SUPER_ADMIN'，
 *     映射 database.reset(SUPER_ADMIN) ⇒ 净效果等价，属**已批准的收紧**（内联 403 换成内核 403）。
 *   - music-source-plugins 八个端点现状 pluginAccess(event, true) = isSuperAdmin（SUPER_ADMIN），
 *     与 ANY → system_settings.write(SUPER_ADMIN) 等价；GET 映射为 system_settings.read(ADMIN)，
 *     比文件守卫**更松** ⇒ 本批**不改这些文件**，作为「需裁决的放开」冻结在此测试里。
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

type Wired = {
  file: string
  method: string
  route: string
  permission: PermissionKey
  policy: string
}

const SYSTEM_BOARD: Wired[] = [
  { file: 'server/api/admin/system-board/index.get.ts', method: 'GET', route: '/api/admin/system-board', permission: 'database.reset', policy: 'canResetDatabase' },
  { file: 'server/api/admin/system-board/events.get.ts', method: 'GET', route: '/api/admin/system-board/events', permission: 'database.reset', policy: 'canResetDatabase' },
  { file: 'server/api/admin/system-board/runtime-clear.post.ts', method: 'POST', route: '/api/admin/system-board/runtime-clear', permission: 'database.reset', policy: 'canResetDatabase' }
]

// 本批刻意保持原样：文件守卫 = SUPER_ADMIN，映射 GET 更松
const PLUGINS_UNCHANGED: Wired[] = [
  { file: 'server/api/admin/music-source-plugins/index.get.ts', method: 'GET', route: '/api/admin/music-source-plugins', permission: 'system_settings.read', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/index.post.ts', method: 'POST', route: '/api/admin/music-source-plugins', permission: 'system_settings.write', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/order.put.ts', method: 'PUT', route: '/api/admin/music-source-plugins/order', permission: 'system_settings.write', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/[id].put.ts', method: 'PUT', route: '/api/admin/music-source-plugins/p1', permission: 'system_settings.write', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/[id].delete.ts', method: 'DELETE', route: '/api/admin/music-source-plugins/p1', permission: 'system_settings.write', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/[id]/enabled.patch.ts', method: 'PATCH', route: '/api/admin/music-source-plugins/p1/enabled', permission: 'system_settings.write', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/[id]/refresh.post.ts', method: 'POST', route: '/api/admin/music-source-plugins/p1/refresh', permission: 'system_settings.write', policy: 'pluginAccess' },
  { file: 'server/api/admin/music-source-plugins/[id]/test.post.ts', method: 'POST', route: '/api/admin/music-source-plugins/p1/test', permission: 'system_settings.write', policy: 'pluginAccess' }
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

function readSource(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

test('S3-B4 路由 → 权限：system-board 3 个端点登记 database.reset 且用 canResetDatabase 接线', () => {
  for (const item of SYSTEM_BOARD) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
    const text = readSource(item.file)
    assert.ok(text.includes('await canResetDatabase(event)'), `${item.file} 必须通过 await canResetDatabase(event) 接线`)
    assert.equal(text.includes('verifyAdminAuth'), false, `${item.file} 仍在使用旧式 verifyAdminAuth`)
  }
})

test('S3-B4 4 角色拒绝矩阵：system-board（database.reset）仅 SUPER_ADMIN', async () => {
  const expected: Record<string, boolean> = {
    USER: false,
    SONG_ADMIN: false,
    ADMIN: false,
    SUPER_ADMIN: true
  }

  for (const role of ROLES) {
    assert.equal(await allowedForRole(role, 'database.reset'), expected[role], `${role} × database.reset`)
  }
})

test('S3-B4 守卫必须在 try 之外：system-board 401/403 不得被 catch 改写成 500', () => {
  for (const item of SYSTEM_BOARD) {
    const text = readSource(item.file)
    const handlerStart = text.indexOf('export default defineEventHandler')
    assert.ok(handlerStart >= 0, `${item.file} 未找到 handler`)
    const handlerText = text.slice(handlerStart)
    const guardIndex = handlerText.indexOf('await canResetDatabase(event)')
    const tryIndex = handlerText.indexOf('try {')
    assert.ok(guardIndex >= 0, `${item.file} 未找到守卫调用`)
    if (tryIndex >= 0) {
      assert.ok(guardIndex < tryIndex, `${item.file} 的守卫位于 try 内，401/403 会被 catch 转成 500`)
    }
  }
})

test('S3-B4 静态接线：system-board 文件内已无角色字面量数组 / 裸 .role 比较 / 直读 context.user', () => {
  for (const item of SYSTEM_BOARD) {
    const text = readSource(item.file)
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${item.file} 仍有 .role 比较`)
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${item.file} 仍有角色字面量数组`
    )
    assert.equal(/context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user（应走 guard）`)
  }
})

test('S3-B4 music-source-plugins 8 个端点保持原判权：仍走 pluginAccess(event, true)', () => {
  for (const item of PLUGINS_UNCHANGED) {
    const text = readSource(item.file)
    assert.ok(text.includes('await pluginAccess(event, true)'), `${item.file} 判权被改动，本批要求原样保留`)
    assert.equal(text.includes('verifyAdminAuth'), false, `${item.file} 不应引入旧式 verifyAdminAuth`)
    assert.equal(/\.role\s*(===|!==)/.test(text), false, `${item.file} 出现裸 .role 比较`)
  }
})

test('S3-B4 music-source-plugins 映射冻结：写操作 SUPER_ADMIN 等价，GET 映射更松（需裁决）', async () => {
  for (const item of PLUGINS_UNCHANGED) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
  }

  // 写操作：映射 system_settings.write(SUPER_ADMIN) 与文件内 isSuperAdmin 守卫等价
  assert.equal(await allowedForRole('ADMIN', 'system_settings.write'), false, 'ADMIN 不应能写音源插件')
  assert.equal(await allowedForRole('SUPER_ADMIN', 'system_settings.write'), true, 'SUPER_ADMIN 应能写音源插件')

  // GET：映射 system_settings.read(ADMIN) 比文件内 SUPER_ADMIN 守卫更松 —— 记录为已知分歧，本批不放开
  assert.equal(await allowedForRole('ADMIN', 'system_settings.read'), true, 'ADMIN 通过 GET 映射的 key')
  const getText = readSource('server/api/admin/music-source-plugins/index.get.ts')
  assert.ok(getText.includes('await pluginAccess(event, true)'), 'GET 端点仍由 pluginAccess 兜住 SUPER_ADMIN')
})
