import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { redactCredentialPatterns } from '../../server/utils/astrbot-error-telemetry.ts'
import {
  ADMIN_PERMISSION_CODES,
  ADMIN_PAGE_IDS,
  ADMIN_PAGE_CAPABILITIES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  canAccessAdminPage,
  canUseAdminPage,
  hasAdminPermission,
  resolveEffectivePermissions,
  PRIV_ADMIN_CONSOLE,
  PRIV_AUDIT,
  PERMISSION_ALL
} from '../../app/utils/admin-permissions.ts'

// 加载带依赖注入的 admin-audit 模块（strip 类型后以函数工厂执行）
function loadAudit(deps: Record<string, unknown>) {
  const source = stripTypeScriptTypes(
    readFileSync(new URL('../../server/utils/admin-audit.ts', import.meta.url), 'utf8')
  )
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^export type .*$/gm, '')
  return new Function(...Object.keys(deps), `${source}; return { recordAdminAudit, ADMIN_AUDIT_RESULT, ADMIN_AUDIT_SUMMARY_MAX_CHARS };`)(
    ...Object.values(deps)
  )
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  const context: Record<string, unknown> = { user: { id: 1, username: 'admin1', name: '管理员一' } }
  const headers: Record<string, string> = { 'user-agent': 'TestAgent/1.0' }
  return {
    context,
    headers,
    node: { req: { socket: { remoteAddress: '127.0.0.1' } } },
    ...overrides
  } as any
}

test('审计能力为超管私有码，不进权限目录与页面码', () => {
  assert.ok(!ADMIN_PERMISSION_CODES.includes(PRIV_AUDIT))
  assert.ok(!ADMIN_PERMISSION_CODES.includes('audit:read'))
  assert.ok(!ADMIN_PERMISSION_CODES.includes('page:audit-log'))
  assert.ok(!ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes(PRIV_AUDIT))
  assert.ok(!ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes('page:audit-log'))
  assert.deepEqual(ADMIN_PAGE_CAPABILITIES['audit-log'], [PRIV_AUDIT])
  assert.ok(ADMIN_PAGE_IDS.includes('audit-log'))

  const superPerms = resolveEffectivePermissions({ role: 'SUPER_ADMIN' }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
  assert.ok(canAccessAdminPage(superPerms, 'audit-log'))
  assert.ok(canUseAdminPage(superPerms, 'audit-log'))
  for (const role of ['ADMIN', 'SONG_ADMIN', 'USER']) {
    const perms = resolveEffectivePermissions({ role }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
    assert.equal(canAccessAdminPage(perms, 'audit-log'), false, role)
  }
})

test('私有码不能通过显式授权或域通配获得', () => {
  assert.equal(hasAdminPermission({ perms: [PRIV_ADMIN_CONSOLE, PRIV_AUDIT] }, PRIV_AUDIT), false)
  assert.equal(canAccessAdminPage([PRIV_AUDIT], 'audit-log'), false)
  assert.equal(hasAdminPermission({ perms: [PRIV_ADMIN_CONSOLE, 'priv:*'] }, PRIV_AUDIT), false)
  assert.equal(hasAdminPermission({ perms: [PRIV_ADMIN_CONSOLE, PERMISSION_ALL] }, PRIV_AUDIT), true)
})

test('recordAdminAudit 写入操作者/IP/UA/结果快照', async () => {
  const captured: Record<string, unknown>[] = []
  const deps = {
    db: { insert: () => ({ values: (v: Record<string, unknown>) => { captured.push(v) } }) },
    adminAuditLogs: {},
    getClientIP: () => '10.0.0.8',
    getHeader: () => 'TestAgent/1.0',
    redactCredentialPatterns: (t: string) => t
  }
  const { recordAdminAudit } = loadAudit(deps)
  await recordAdminAudit(makeEvent(), 'user.status', {
    targetType: 'user',
    targetId: 42,
    summary: { oldStatus: 'active', newStatus: 'banned' }
  })
  assert.equal(captured.length, 1)
  const row = captured[0]!
  assert.equal(row.actorId, 1)
  assert.equal(row.actorName, '管理员一')
  assert.equal(row.action, 'user.status')
  assert.equal(row.targetType, 'user')
  assert.equal(row.targetId, '42')
  assert.equal(row.ipAddress, '10.0.0.8')
  assert.equal(row.userAgent, 'TestAgent/1.0')
  assert.equal(row.result, 'SUCCESS')
  assert.equal(JSON.parse(row.summary as string).newStatus, 'banned')
})

test('摘要脱敏：凭据样式内容被替换为占位符', async () => {
  const captured: Record<string, unknown>[] = []
  const deps = {
    db: { insert: () => ({ values: (v: Record<string, unknown>) => { captured.push(v) } }) },
    adminAuditLogs: {},
    getClientIP: () => 'unknown',
    getHeader: () => '',
    redactCredentialPatterns
  }
  const { recordAdminAudit } = loadAudit(deps)
  await recordAdminAudit(makeEvent(), 'settings.update', {
    targetType: 'settings',
    summary: { token: 'Bearer abcdef123456' }
  })
  const summary = JSON.parse(captured[0]!.summary as string)
  assert.equal(summary.token, '[已脱敏]')
})

test('写入异常静默失败，不抛出', async () => {
  const deps = {
    db: { insert: () => ({ values: () => { throw new Error('db down') } }) },
    adminAuditLogs: {},
    getClientIP: () => 'unknown',
    getHeader: () => '',
    redactCredentialPatterns: (t: string) => t
  }
  const { recordAdminAudit } = loadAudit(deps)
  await recordAdminAudit(makeEvent(), 'user.create', { summary: { username: 'x' } })
})

test('摘要长度上限为 2000 字符，不再沿用群聊摘要的 300 字截断', async () => {
  const captured: Record<string, unknown>[] = []
  const deps = {
    db: { insert: () => ({ values: (v: Record<string, unknown>) => { captured.push(v) } }) },
    adminAuditLogs: {},
    getClientIP: () => 'unknown',
    getHeader: () => '',
    redactCredentialPatterns: (t: string) => t
  }
  const { recordAdminAudit } = loadAudit(deps)
  const field = 'x'.repeat(500)

  await recordAdminAudit(makeEvent(), 'settings.update', {
    summary: { first: field, second: field, third: field }
  })
  const normal = captured[0]!.summary as string
  assert.ok(normal.length > 300, `摘要被意外截短: ${normal.length}`)
  assert.ok(normal.length <= 2000)

  await recordAdminAudit(makeEvent(), 'settings.update', {
    summary: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, field]))
  })
  assert.equal((captured[1]!.summary as string).length, 2000)
})
