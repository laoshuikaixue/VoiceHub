import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeApiLogLevel,
  normalizeRetentionDays,
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

  assert.equal(normalizeRetentionDays(0, 90), 0)
  assert.equal(normalizeRetentionDays(30, 90), 30)
  assert.equal(normalizeRetentionDays(3650, 90), 3650)
  assert.equal(normalizeRetentionDays(3651, 90), 90)
  assert.equal(normalizeRetentionDays(-1, 90), 90)
  assert.equal(normalizeRetentionDays(1.5, 90), 90)
  assert.equal(normalizeRetentionDays('abc', 180), 180)
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

test('日志管理权限码进入目录与 ADMIN 模板', () => {
  assert.ok(permissions.ADMIN_PERMISSION_CODES.includes('logs:read'))
  assert.ok(permissions.ADMIN_PERMISSION_CODES.includes('logs:manage'))
  assert.ok(permissions.ADMIN_PERMISSION_CODES.includes('page:logs'))
  assert.ok(permissions.ADMIN_PAGE_IDS.includes('logs'))
  assert.deepEqual(permissions.ADMIN_PAGE_CAPABILITIES.logs, ['logs:read'])
  assert.ok(permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes('logs:read'))
  assert.ok(permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes('logs:manage'))
  assert.ok(permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN.includes('page:logs'))
})

test('日志管理页面：ADMIN 可见，SONG_ADMIN/USER 不可见', () => {
  const admin = permissions.resolveEffectivePermissions(
    { role: 'ADMIN' },
    permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT
  )
  assert.equal(permissions.canAccessAdminPage(admin, 'logs'), true)
  assert.equal(permissions.canUseAdminPage(admin, 'logs'), true)

  for (const role of ['SONG_ADMIN', 'USER']) {
    const perms = permissions.resolveEffectivePermissions(
      { role },
      permissions.ROLE_PERMISSION_TEMPLATES_DEFAULT
    )
    assert.equal(permissions.canAccessAdminPage(perms, 'logs'), false, role)
  }
})

test('logs:manage 隐含 logs:read，且都需要后台闸门码', () => {
  const manageOnly = [consoleCode, 'logs:manage']
  assert.equal(permissions.hasPermission(manageOnly, 'logs:read'), true)
  assert.equal(permissions.hasPermission(manageOnly, 'logs:manage'), true)

  assert.equal(permissions.hasPermission(['logs:manage'], 'logs:read'), true)
  assert.equal(permissions.canAccessAdminPage(['logs:read'], 'logs'), false)

  const readOnly = [consoleCode, 'logs:read']
  assert.equal(permissions.hasPermission(readOnly, 'logs:manage'), false)
})

test('日志接口守卫：查询/导出用 logs:read，清理用 logs:manage', () => {
  for (const [pathname, method, code] of [
    ['/api/admin/log-management/access', 'GET', 'logs:read'],
    ['/api/admin/log-management/access/export', 'GET', 'logs:read'],
    ['/api/admin/log-management/stats', 'GET', 'logs:read'],
    ['/api/admin/log-management/cleanup', 'POST', 'logs:manage'],
    ['/api/admin/audit-logs/export', 'GET', 'audit:read']
  ] as const) {
    const guard = resolveAdminRouteGuard(pathname, method)
    assert.ok(guard && !guard.deny && !guard.fallback, `${method} ${pathname}`)
    assert.deepEqual(guard!.any, [code], `${method} ${pathname}`)
  }

  // 未登记的写操作仍按缺省策略拒绝
  const unknownWrite = resolveAdminRouteGuard('/api/admin/log-management/unknown', 'POST')
  assert.equal(unknownWrite?.deny, true)
  assert.equal(unknownWrite?.fallback, true)
})

test('logging 配置作用域只暴露 3 个字段并按 logs 权限读写', () => {
  assert.deepEqual([...ADMIN_SETTINGS_SCOPES.logging.fields].sort(), [
    'apiLogLevel',
    'apiLogRetentionDays',
    'auditLogRetentionDays'
  ])
  assert.deepEqual([...ADMIN_SETTINGS_SCOPES.logging.read], ['logs:read'])
  assert.deepEqual([...ADMIN_SETTINGS_SCOPES.logging.write], ['logs:manage'])

  assert.equal(canAccessSettingsScope({ perms: [consoleCode, 'logs:read'] }, 'logging'), true)
  assert.equal(canAccessSettingsScope({ perms: [consoleCode, 'logs:read'] }, 'logging', true), false)
  assert.equal(canAccessSettingsScope({ perms: [consoleCode, 'logs:manage'] }, 'logging', true), true)

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
    ['GET', 'logs:read'],
    ['POST', 'logs:manage']
  ] as const) {
    const guard = resolveAdminRouteGuard('/api/admin/system-settings/logging', method)
    assert.ok(guard && !guard.deny && !guard.fallback)
    assert.deepEqual(guard!.any, [code], method)
  }
})
