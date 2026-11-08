import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeApiLogLevel,
  normalizeRetentionDays,
  parseLogCleanupType,
  resolveLogSettings,
  shouldRecordApiLog
} from '../../server/utils/log-settings.ts'
import {
  buildCsv,
  buildJsonLines,
  escapeCsvCell,
  readExportFormat
} from '../../server/utils/log-export.ts'
import * as permissions from '../../app/utils/admin-permissions.ts'
import { resolveAdminRouteGuard } from '../../server/utils/admin-permission-routes.ts'
import {
  ADMIN_SETTINGS_SCOPES,
  canAccessSettingsScope,
  invalidScopeFields,
  pickScopeSettings
} from '../../server/utils/admin-settings-scope.ts'

const consoleCode = permissions.PRIV_ADMIN_CONSOLE
const PRIV_AUDIT = permissions.PRIV_AUDIT
const PRIV_LOGS = permissions.PRIV_LOGS

test('API 日志记录级别按 off / errors / all 门控', () => {
  assert.equal(shouldRecordApiLog('all', 200), true)
  assert.equal(shouldRecordApiLog('all', 500), true)
  assert.equal(shouldRecordApiLog('errors', 200), false)
  assert.equal(shouldRecordApiLog('errors', 302), false)
  assert.equal(shouldRecordApiLog('errors', 400), true)
  assert.equal(shouldRecordApiLog('errors', 500), true)
  assert.equal(shouldRecordApiLog('off', 200), false)
  assert.equal(shouldRecordApiLog('off', 500), false)
})

test('非法记录级别回退为 all，保留天数非法值回退默认', () => {
  assert.equal(normalizeApiLogLevel('errors'), 'errors')
  assert.equal(normalizeApiLogLevel('off'), 'off')
  assert.equal(normalizeApiLogLevel('bogus'), 'all')
  assert.equal(normalizeApiLogLevel(null), 'all')

  // 0 = 永久保留始终允许；否则不得低于该类型下限
  assert.equal(normalizeRetentionDays(0, 90, 7), 0)
  assert.equal(normalizeRetentionDays(30, 90, 7), 30)
  assert.equal(normalizeRetentionDays(3650, 90, 7), 3650)
  assert.equal(normalizeRetentionDays(3651, 90, 7), 90)
  assert.equal(normalizeRetentionDays(-1, 90, 7), 90)
  assert.equal(normalizeRetentionDays(1.5, 90, 7), 90)
  assert.equal(normalizeRetentionDays('abc', 180, 30), 180)
  // 低于下限（如 1 天）回退默认，防止改小后清理掉近期日志
  assert.equal(normalizeRetentionDays(1, 90, 7), 90)
  assert.equal(normalizeRetentionDays(7, 90, 7), 7)
  assert.equal(normalizeRetentionDays(29, 180, 30), 180)
  assert.equal(normalizeRetentionDays(30, 180, 30), 30)
})

test('配置缺失或非法时按默认值降级，合法值原样保留', () => {
  assert.deepEqual(resolveLogSettings(null), {
    apiLogLevel: 'all',
    apiLogRetentionDays: 90,
    auditLogRetentionDays: 180
  })
  assert.deepEqual(
    resolveLogSettings({ apiLogLevel: 'bogus', apiLogRetentionDays: -1, auditLogRetentionDays: 9999 }),
    { apiLogLevel: 'all', apiLogRetentionDays: 90, auditLogRetentionDays: 180 }
  )
  assert.deepEqual(
    resolveLogSettings({ apiLogLevel: 'errors', apiLogRetentionDays: 0, auditLogRetentionDays: 30 }),
    { apiLogLevel: 'errors', apiLogRetentionDays: 0, auditLogRetentionDays: 30 }
  )
  // 低于下限的保留天数回退默认，避免被改小后清掉近期日志
  assert.deepEqual(
    resolveLogSettings({ apiLogRetentionDays: 1, auditLogRetentionDays: 1 }),
    { apiLogLevel: 'all', apiLogRetentionDays: 90, auditLogRetentionDays: 180 }
  )
  assert.deepEqual(
    resolveLogSettings({ apiLogRetentionDays: 7, auditLogRetentionDays: 30 }),
    { apiLogLevel: 'all', apiLogRetentionDays: 7, auditLogRetentionDays: 30 }
  )
})

test('清理类型只接受 api / audit / all，非法值返回 null', () => {
  assert.equal(parseLogCleanupType('api'), 'api')
  assert.equal(parseLogCleanupType('audit'), 'audit')
  // all 仍可被解析，但清理接口会显式拒绝，避免顺手抹掉审计记录
  assert.equal(parseLogCleanupType('all'), 'all')
  assert.equal(parseLogCleanupType(undefined), null)
  assert.equal(parseLogCleanupType(null), null)
  assert.equal(parseLogCleanupType('apii'), null)
  assert.equal(parseLogCleanupType(''), null)
})

test('CSV 导出带 BOM、转义引号并阻止公式注入', () => {
  assert.ok(buildCsv(['a'], []).startsWith('\ufeff'))
  assert.equal(escapeCsvCell('=1+1'), '\t=1+1')
  assert.equal(escapeCsvCell('+86'), '\t+86')
  assert.equal(escapeCsvCell('-1'), '\t-1')
  assert.equal(escapeCsvCell('@user'), '\t@user')
  assert.equal(escapeCsvCell('a,b'), '"a,b"')
  assert.equal(escapeCsvCell('a"b'), '"a""b"')
  assert.equal(escapeCsvCell('a\nb'), '"a\nb"')
  assert.equal(escapeCsvCell(null), '')
  assert.equal(escapeCsvCell(undefined), '')

  const csv = buildCsv(['time', 'msg'], [['10:00', '=cmd']])
  assert.equal(csv, '\ufefftime,msg\n10:00,\t=cmd')
})

test('JSON Lines 导出逐行一条并保留末尾换行', () => {
  assert.equal(buildJsonLines([]), '')
  const lines = buildJsonLines([{ a: 1 }, { b: 'x' }])
  assert.equal(lines, '{"a":1}\n{"b":"x"}\n')
  assert.equal(lines.trimEnd().split('\n').length, 2)
})

test('导出格式只接受 csv / jsonl，其余回退 csv', () => {
  assert.equal(readExportFormat('jsonl'), 'jsonl')
  assert.equal(readExportFormat('csv'), 'csv')
  assert.equal(readExportFormat('xlsx'), 'csv')
  assert.equal(readExportFormat(undefined), 'csv')
})

test('日志管理为超管私有码，不进权限目录与 ADMIN 模板', () => {
  assert.ok(!permissions.ADMIN_PERMISSION_CODES.includes('logs:read'))
  assert.ok(!permissions.ADMIN_PERMISSION_CODES.includes('logs:manage'))
  assert.ok(!permissions.ADMIN_PERMISSION_CODES.includes('page:logs'))
  assert.ok(permissions.ADMIN_PAGE_IDS.includes('logs'))
  assert.deepEqual(permissions.ADMIN_PAGE_CAPABILITIES.logs, [PRIV_LOGS])
  assert.ok(!permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes(PRIV_LOGS))
  assert.ok(!permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes('page:logs'))
})

test('日志管理页面仅超管可见', () => {
  const superPerms = permissions.resolveEffectivePermissions(
    { role: 'SUPER_ADMIN' },
    permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT
  )
  assert.equal(permissions.canAccessAdminPage(superPerms, 'logs'), true)
  assert.equal(permissions.canUseAdminPage(superPerms, 'logs'), true)

  for (const role of ['ADMIN', 'SONG_ADMIN', 'USER']) {
    const perms = permissions.resolveEffectivePermissions(
      { role },
      permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT
    )
    assert.equal(permissions.canAccessAdminPage(perms, 'logs'), false, role)
  }
})

test('私有码不接受显式授权与域通配', () => {
  assert.equal(permissions.hasPermission([PRIV_LOGS], PRIV_LOGS), false)
  assert.equal(permissions.hasPermission([consoleCode, 'priv:*'], PRIV_LOGS), false)
  assert.equal(permissions.hasPermission([consoleCode, permissions.PERMISSION_ALL], PRIV_LOGS), true)
})

test('日志接口守卫：查询/导出与清理都要求超管私有码', () => {
  for (const [pathname, method] of [
    ['/api/admin/log-management/access', 'GET'],
    ['/api/admin/log-management/access/export', 'GET'],
    ['/api/admin/log-management/stats', 'GET'],
    ['/api/admin/log-management/cleanup', 'POST'],
    ['/api/admin/audit-logs/export', 'GET']
  ] as const) {
    const guard = resolveAdminRouteGuard(pathname, method)
    assert.ok(guard && !guard.deny && !guard.fallback, `${method} ${pathname}`)
    const expected = pathname.includes('/audit-logs') ? PRIV_AUDIT : PRIV_LOGS
    assert.deepEqual(guard!.any, [expected], `${method} ${pathname}`)
  }

  // 未登记的写操作仍按缺省策略拒绝
  const unknownWrite = resolveAdminRouteGuard('/api/admin/log-management/unknown', 'POST')
  assert.equal(unknownWrite?.deny, true)
  assert.equal(unknownWrite?.fallback, true)
})

test('logging 配置作用域只暴露 3 个字段并要求超管私有码', () => {
  assert.deepEqual([...ADMIN_SETTINGS_SCOPES.logging.fields].sort(), [
    'apiLogLevel',
    'apiLogRetentionDays',
    'auditLogRetentionDays'
  ])
  assert.deepEqual([...ADMIN_SETTINGS_SCOPES.logging.read], [PRIV_LOGS])
  assert.deepEqual([...ADMIN_SETTINGS_SCOPES.logging.write], [PRIV_LOGS])

  assert.equal(canAccessSettingsScope({ perms: [consoleCode, PRIV_LOGS] }, 'logging'), false)
  assert.equal(canAccessSettingsScope({ perms: [consoleCode, permissions.PERMISSION_ALL] }, 'logging'), true)
  assert.equal(canAccessSettingsScope({ perms: [consoleCode, permissions.PERMISSION_ALL] }, 'logging', true), true)

  assert.deepEqual(invalidScopeFields('logging', { apiLogLevel: 'all' }), [])
  assert.deepEqual(invalidScopeFields('logging', { smtpHost: 'x' }), ['smtpHost'])

  const picked = pickScopeSettings('logging', {
    apiLogLevel: 'errors',
    apiLogRetentionDays: 30,
    auditLogRetentionDays: 60,
    smtpHost: 'mail'
  })
  assert.deepEqual(picked, {
    apiLogLevel: 'errors',
    apiLogRetentionDays: 30,
    auditLogRetentionDays: 60
  })

  for (const [method, code] of [
    ['GET', PRIV_LOGS],
    ['POST', PRIV_LOGS]
  ] as const) {
    const guard = resolveAdminRouteGuard('/api/admin/system-settings/logging', method)
    assert.ok(guard && !guard.deny && !guard.fallback)
    assert.deepEqual(guard!.any, [code], method)
  }
})
