/**
 * S3-B5 批次验收测试：backup 域接线（R2-E 备份域）。
 *
 * 裁决：
 *   - 17 个备份端点现状均为文件内 \`!user || user.role !== 'SUPER_ADMIN'\`（零行为变更目标）；
 *   - \`routePermissionMap.ts:125-129\` 三条 key（backup.execute / backup.export / backup.restore）
 *     的 catalog minRole 均 SUPER_ADMIN ⇒ 内联 403 换成内核 403，净效果逐条等价；
 *   - \`restore.post.ts\` / \`restore-chunk.post.ts\` 的 \`overwriteSuperAdmin\` 分支是**客体角色分支**
 *     （与 RBAC_ENABLED 无关，必须始终生效），改用白名单函数 \`isSuperAdmin(user)\`，逻辑与文案不动；
 *   - 其余 \`.role\` 读取全是 SQL 列引用（\`eq(users.role, ...)\`）与备份记录对象读取
 *     （\`record.role\` / \`targetUser.role\`），不属于角色矩阵，保持不动。
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
  /** 守卫返回值是否被后续业务逻辑消费（决定用 const user = ... 还是裸 await） */
  keepsUser: boolean
}

const BACKUP: Wired[] = [
  { file: 'server/api/admin/backup/auto-config.get.ts', method: 'GET', route: '/api/admin/backup/auto-config', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/auto-config.put.ts', method: 'PUT', route: '/api/admin/backup/auto-config', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/clear.post.ts', method: 'POST', route: '/api/admin/backup/clear', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: true },
  { file: 'server/api/admin/backup/delete/[filename].delete.ts', method: 'DELETE', route: '/api/admin/backup/delete/b1.json', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: true },
  { file: 'server/api/admin/backup/download.get.ts', method: 'GET', route: '/api/admin/backup/download', permission: 'backup.export', policy: 'canExportBackup', keepsUser: false },
  { file: 'server/api/admin/backup/download/[filename].get.ts', method: 'GET', route: '/api/admin/backup/download/b1.json', permission: 'backup.export', policy: 'canExportBackup', keepsUser: true },
  { file: 'server/api/admin/backup/export.post.ts', method: 'POST', route: '/api/admin/backup/export', permission: 'backup.export', policy: 'canExportBackup', keepsUser: true },
  { file: 'server/api/admin/backup/history-clear.post.ts', method: 'POST', route: '/api/admin/backup/history-clear', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/history.get.ts', method: 'GET', route: '/api/admin/backup/history', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/list.get.ts', method: 'GET', route: '/api/admin/backup/list', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/restore.post.ts', method: 'POST', route: '/api/admin/backup/restore', permission: 'backup.restore', policy: 'canRestoreBackup', keepsUser: true },
  { file: 'server/api/admin/backup/restore-chunk.post.ts', method: 'POST', route: '/api/admin/backup/restore-chunk', permission: 'backup.restore', policy: 'canRestoreBackup', keepsUser: true },
  { file: 'server/api/admin/backup/test-email.post.ts', method: 'POST', route: '/api/admin/backup/test-email', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/test-s3.post.ts', method: 'POST', route: '/api/admin/backup/test-s3', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/test-telegram.post.ts', method: 'POST', route: '/api/admin/backup/test-telegram', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/test-webdav.post.ts', method: 'POST', route: '/api/admin/backup/test-webdav', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: false },
  { file: 'server/api/admin/backup/upload.post.ts', method: 'POST', route: '/api/admin/backup/upload', permission: 'backup.execute', policy: 'canExecuteBackup', keepsUser: true }
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

test('S3-B5 路由 → 权限：17 个备份端点按 routePermissionMap 登记三条 key 并用具名策略接线', () => {
  for (const item of BACKUP) {
    assert.equal(resolveRoutePermission(item.method, item.route), item.permission, `${item.method} ${item.route}`)
    const text = readSource(item.file)
    const call = item.keepsUser ? `const user = await ${item.policy}(event)` : `await ${item.policy}(event)`
    assert.ok(text.includes(call), `${item.file} 必须通过 ${call} 接线`)
    assert.ok(text.includes(`import { `) && text.includes(`} from '~~/server/utils/rbac'`), `${item.file} 未从内核 barrel 导入策略`)
  }
})

test('S3-B5 4 角色拒绝矩阵：backup.execute / backup.export / backup.restore 均仅 SUPER_ADMIN', async () => {
  const expected: Record<string, boolean> = { USER: false, SONG_ADMIN: false, ADMIN: false, SUPER_ADMIN: true }
  for (const permission of ['backup.execute', 'backup.export', 'backup.restore'] as PermissionKey[]) {
    for (const role of ROLES) {
      assert.equal(await allowedForRole(role, permission), expected[role], `${role} × ${permission}`)
    }
  }
})

test('S3-B5 守卫必须在 try 之外：17 个端点的 401/403 不得被 catch 改写成 500', () => {
  for (const item of BACKUP) {
    const text = readSource(item.file)
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

test('S3-B5 静态接线：17 个文件内已无内联角色判权（直读 context.user / user.role 比较）', () => {
  for (const item of BACKUP) {
    const text = readSource(item.file)
    assert.equal(/context\.user/.test(text), false, `${item.file} 仍在直读 event.context.user（应走 guard）`)
    assert.equal(/\buser\.role\s*(===|!==)/.test(text), false, `${item.file} 仍有 user.role 比较`)
    assert.equal(/if \(!user \|\| user\.role !== 'SUPER_ADMIN'\)/.test(text), false, `${item.file} 仍保留内联角色矩阵`)
  }
})

test('S3-B5 客体角色分支：restore / restore-chunk 的 overwriteSuperAdmin 改用 isSuperAdmin(user)', () => {
  for (const file of ['server/api/admin/backup/restore.post.ts', 'server/api/admin/backup/restore-chunk.post.ts']) {
    const text = readSource(file)
    assert.ok(text.includes('if (overwriteSuperAdmin && !isSuperAdmin(user)) {'), `${file} 客体分支未改用 isSuperAdmin`)
    assert.equal(/user\.role/.test(text), false, `${file} 仍有 actor 的 .role 裸读`)
  }
  // 客体分支语义：仅 SUPER_ADMIN 可覆盖超管账号数据
  assert.equal(readSource('server/api/admin/backup/restore.post.ts').includes('仅超级管理员可以覆盖超级管理员账号数据'), true)
  assert.equal(readSource('server/api/admin/backup/restore-chunk.post.ts').includes('仅超级管理员可以覆盖超级管理员账号数据'), true)
})

test('S3-B5 SQL 列引用与备份记录对象读取保持不动', () => {
  assert.ok(readSource('server/api/admin/backup/clear.post.ts').includes("eq(users.role, 'SUPER_ADMIN')"), 'clear.post.ts 的 SQL 列引用被误改')
  assert.ok(readSource('server/api/admin/backup/restore.post.ts').includes("eq(users.role, 'SUPER_ADMIN')"), 'restore.post.ts 的 SQL 列引用被误改')
  assert.ok(readSource('server/api/admin/backup/restore.post.ts').includes("record?.role === 'SUPER_ADMIN'"), 'restore.post.ts 的备份记录读取被误改')
  assert.ok(readSource('server/api/admin/backup/restore-chunk.post.ts').includes("record.role === 'SUPER_ADMIN'"), 'restore-chunk.post.ts 的备份记录读取被误改')
})
