import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createError } from 'h3'
import test from 'node:test'
import * as permissions from '../../app/utils/admin-permissions.ts'
import * as scopes from '../../server/utils/admin-settings-scope.ts'
import { resolvePermissionRouteGuard } from '../../server/utils/admin-permission-routes.ts'
import { SERVER_ERROR_CODES, MUSIC_SOURCE_PLATFORMS } from '../../server/config/constants.ts'
import { createApiError } from '../../server/utils/apiError.ts'
import { maskSystemSettingsSecrets, SMTP_PASSWORD_MASK, SECRET_FIELD_MASK } from '../../server/api/admin/system-settings/secretMask.ts'
import { findSuperAdminOnlySettingFields, stripSuperAdminOnlySettingFields } from '../../app/utils/settingsPermissions.ts'
import { resolveSmtpTestConfig } from '../../server/utils/smtp-test-config.ts'
import { parseEsaCaptchaScenes } from '../../app/utils/esaCaptcha.ts'

const consoleCode = permissions.PRIV_ADMIN_CONSOLE
const role = (...codes: string[]) => [consoleCode, ...codes]

test('单功能授权自动出现可用入口，操作权限提供必要读取但不提供其他写入', () => {
  const cases = [
    ['songs:review', 'songs', 'songs:read'], ['songs:delete', 'songs', 'songs:read'],
    ['schedule:write', 'schedule', 'schedule:read'], ['stats:read', 'data-analysis', 'stats:read'],
    ['activities:read', 'overview', 'activities:read'], ['system:read', 'overview', 'system:read'],
    ['users:approve', 'users', 'users:read'], ['users:reset-password', 'users', 'users:read'],
    ['users:assign-role', 'users', 'users:read'], ['priv:grant', 'users', 'users:read'],
    ['grade-class:delete', 'grade-class', 'grade-class:read'], ['blacklist:write', 'blacklist', 'blacklist:read'],
    ['play-times:write', 'playtimes', 'play-times:read'], ['request-times:write', 'request-times', 'request-times:read'],
    ['semesters:delete', 'semesters', 'semesters:read'], ['card-codes:assign', 'card-codes', 'card-codes:read'],
    ['replay-requests:write', 'schedule', 'replay-requests:read'], ['smtp:write', 'smtp-config', 'smtp:read'],
    ['smtp:test', 'smtp-config', 'smtp:read'], ['astrbot:write', 'smtp-config', 'astrbot:read'],
    ['email-templates:write', 'smtp-config', 'email-templates:read'], ['notifications:delete', 'notifications', 'notifications:read'],
    ['music-source:write', 'music-source', 'music-source:read'], ['music-source-plugins:write', 'music-source', 'music-source-plugins:read'],
    ['api-keys:write', 'api-keys', 'api-keys:read'], ['backup:write', 'database', 'backup:read'],
    ['backup:restore', 'database', 'backup:restore'], ['database:maintenance', 'database', 'database:read'],
    ['system-board:write', 'system-board', 'system-board:read'], ['priv:role-template', 'permissions', 'priv:role-template'],
    ['system-settings:write', 'site-config', 'system-settings:read']
  ]
  for (const [action, page, read] of cases) {
    const perms = role(action)
    assert.ok(permissions.canAccessAdminPage(perms, page), action)
    assert.ok(permissions.canUseAdminPage(perms, page), action)
    assert.ok(permissions.hasPermission(perms, read), action)
    for (const forbidden of ['database:reset', 'backup:restore', 'system-settings:secrets', 'priv:grant']) {
      if (action !== forbidden) assert.equal(permissions.hasPermission(perms, forbidden), false, `${action} 不得授予 ${forbidden}`)
    }
  }
  assert.deepEqual(permissions.accessiblePages(role('smtp:write')), ['smtp-config'])
  assert.equal(permissions.hasPermission(role('users:approve'), 'users:write'), false)
  assert.equal(permissions.hasPermission(role('songs:review'), 'songs:delete'), false)
})

test('后台闸门、页面拒绝和数据读取拒绝均不能被自动关联绕过', () => {
  assert.deepEqual(permissions.accessiblePages(['smtp:write']), [])
  for (const deny of ['!page:smtp-config', '!page:*', '!priv:admin-console', '!*']) {
    assert.equal(permissions.canAccessAdminPage(role('smtp:write', 'page:smtp-config', deny), 'smtp-config'), false)
  }
  const deniedRead = role('smtp:write', 'page:smtp-config', '!smtp:read')
  assert.equal(permissions.hasPermission(deniedRead, 'smtp:read'), false)
  assert.equal(permissions.canUseAdminPage(deniedRead, 'smtp-config'), false)
  assert.equal(permissions.canUseAdminPage(role('page:smtp-config'), 'smtp-config'), false)
  assert.equal(permissions.canUseAdminPage(role('smtp:write'), 'unknown'), false)
  for (const unknown of ['__proto__', 'constructor', 'toString']) {
    assert.equal(permissions.hasPermission(role('smtp:write'), unknown), false)
    assert.equal(permissions.canUseAdminPage(role('smtp:write'), unknown), false)
  }
})

test('授权边界包含操作间接提供的读取权限，拒绝读取者不能恢复他人的读取', () => {
  assert.equal(permissions.canGrantPermissionToken('smtp:write', role('smtp:write', '!smtp:read')), false)
  assert.equal(permissions.canGrantPermissionToken('schedule:write', role('schedule:write', '!songs:read')), false)
  assert.equal(permissions.canGrantPermissionToken('smtp:write', role('smtp:write')), true)
})

test('模块配置的路由和字段边界一致，读权限不能写配置', () => {
  for (const [scope, config] of Object.entries(scopes.ADMIN_SETTINGS_SCOPES)) {
    for (const [method, codes] of [['GET', config.read], ['POST', config.write]] as const) {
      const guard = resolvePermissionRouteGuard(`/api/admin/system-settings/${scope}`, method)!
      assert.equal(guard.fallback, false)
      assert.deepEqual(guard.any, codes)
    }
    const name = scope as scopes.AdminSettingsScope
    assert.equal(scopes.canAccessSettingsScope({ perms: role(config.read[0]) }, name, true), false)
    assert.deepEqual(scopes.invalidScopeFields(name, { [config.fields[0]]: false }), [])
    assert.deepEqual(scopes.invalidScopeFields(name, { rolePermissionTemplates: {} }), ['rolePermissionTemplates'])
    assert.deepEqual(scopes.invalidScopeFields(name, []), ['body'])
  }
  assert.equal(scopes.isAdminSettingsScope('__proto__'), false)
  assert.equal(scopes.isAdminSettingsScope('constructor'), false)
  assert.equal(scopes.canAccessSettingsScope({ perms: role('smtp:write') }, 'astrbot'), false)
  assert.equal(scopes.canAccessSettingsScope({ perms: role('smtp:write') }, 'music-source', true), false)
})

function handler(file: string, dependencies: Record<string, unknown>) {
  let source = stripTypeScriptTypes(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))
  source = source.replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace('export default defineEventHandler', 'return defineEventHandler')
    .replace("await import('~~/server/services/smtpService')", '({ SmtpService: smtpStub })')
  return new Function(...Object.keys(dependencies), source)(...Object.values(dependencies))
}

function settingsRuntime() {
  let settings: Record<string, any> = {
    id: 1, smtpEnabled: false, smtpHost: 'mail.school.example', smtpUsername: 'school',
    smtpPort: 587, smtpSecure: true, smtpPassword: 'saved-secret', astrbotToken: 'bot-secret',
    customOAuthClientSecret: 'oauth-secret', rolePermissionTemplates: { PRIVATE: ['*'] },
    enablePlayTimeSelection: true, playSlotRequired: false, enableRequestTimeLimitation: true,
    forceBlockAllRequests: false, enabledPlatforms: '["netease"]', platformOrder: '["netease"]',
    sameSongRestrictionHours: 3, enableSubmissionRestriction: true
  }
  let writes = 0
  const db = {
    select: () => ({ from: () => ({ limit: async () => [{ ...settings }] }) }),
    update: () => ({ set: (patch: any) => ({ where: () => ({ returning: async () => {
      settings = { ...settings, ...patch }; writes++; return [{ ...settings }]
    } }) }) })
  }
  const deps = {
    ...permissions, ...scopes, db, systemSettings: { id: 'id' },
    eq: () => null, defineEventHandler: (fn: any) => fn, readBody: async (event: any) => event.body,
    getMethod: (event: any) => event.method, getRouterParam: (event: any) => event.scope,
    createApiError, createError, SERVER_ERROR_CODES, maskSystemSettingsSecrets, SMTP_PASSWORD_MASK, SECRET_FIELD_MASK, parseEsaCaptchaScenes,
    stripSuperAdminOnlySettingFields, findSuperAdminOnlySettingFields, MUSIC_SOURCE_PLATFORMS,
    getAggregateOAuthLoginTypesOrDefault: () => [],
    smtpStub: { getInstance: () => ({ initializeSmtpConfig: async () => true }) }
  }
  const readSettings = handler('server/api/admin/system-settings/index.ts', deps)
  const writeSettings = handler('server/api/admin/system-settings/index.post.ts', deps)
  const scoped = handler('server/api/admin/system-settings/[scope].ts', { ...deps, readSettings, writeSettings })
  const call = (scope: string, method: string, codes: string[], body?: any) => scoped({ scope, method, body, context: { user: { perms: role(...codes) } } })
  return { call, settings: () => settings, writes: () => writes }
}

test('实际模块配置处理器读取和保存均裁剪字段，掩码不能回写成真实密码', async () => {
  const runtime = settingsRuntime()
  const response = await runtime.call('smtp', 'GET', ['smtp:write'])
  assert.equal(response.smtpPassword, SMTP_PASSWORD_MASK)
  for (const field of ['astrbotToken', 'customOAuthClientSecret', 'rolePermissionTemplates', 'enablePlayTimeSelection']) assert.equal(field in response, false)
  const saved = await runtime.call('smtp', 'POST', ['smtp:write'], { smtpPassword: SMTP_PASSWORD_MASK, smtpFromName: '学校广播站' })
  assert.equal(saved.smtpFromName, '学校广播站')
  assert.equal(runtime.settings().smtpPassword, 'saved-secret')
  assert.equal(runtime.settings().astrbotToken, 'bot-secret')
  assert.equal('astrbotToken' in saved, false)
  assert.equal(runtime.writes(), 1)
})

test('实际配置处理器拒绝跨模块写入、只读写入和其他模块读取，失败时不落库', async () => {
  const runtime = settingsRuntime()
  for (const body of [{ astrbotToken: 'attacker' }, { rolePermissionTemplates: {} }, { smtpHost: 'mail', allowRegister: false }, []]) {
    await assert.rejects(runtime.call('smtp', 'POST', ['smtp:write'], body), { statusCode: 400 })
  }
  await assert.rejects(runtime.call('smtp', 'POST', ['smtp:read'], { smtpEnabled: false }), { statusCode: 403 })
  await assert.rejects(runtime.call('astrbot', 'GET', ['smtp:write']), { statusCode: 403 })
  await assert.rejects(runtime.call('__proto__', 'GET', ['*']), { statusCode: 404 })
  assert.equal(runtime.writes(), 0)
})

test('播出、投稿和音源配置独立授权即可保存，不能读取其他模块设置', async () => {
  const runtime = settingsRuntime()
  for (const [scope, code, body] of [
    ['play-times', 'play-times:write', { enablePlayTimeSelection: true, playSlotRequired: true }],
    ['request-times', 'request-times:write', { forceBlockAllRequests: true }],
    ['music-source', 'music-source:write', { enabledPlatforms: '["netease"]', platformOrder: '["netease"]' }],
    ['astrbot', 'astrbot:write', { astrbotEnabled: false }]
  ] as const) {
    const saved = await runtime.call(scope, 'POST', [code], body)
    for (const field of Object.keys(body)) assert.equal(saved[field], body[field])
    assert.equal('smtpPassword' in saved, false)
    assert.equal('customOAuthClientSecret' in saved, false)
  }
  assert.equal(runtime.writes(), 4)
})

test('SMTP 测试权限不能改变凭据投递目标，保存密码只能用于原服务器', () => {
  const stored = { smtpEnabled: true, smtpHost: 'mail.school.example', smtpPort: 587, smtpSecure: true, smtpUsername: 'school', smtpPassword: 'saved-secret' }
  const attack = { ...stored, smtpHost: 'attacker.example', smtpPassword: SMTP_PASSWORD_MASK }
  assert.equal(resolveSmtpTestConfig(attack, stored, false).smtpHost, stored.smtpHost)
  assert.equal(resolveSmtpTestConfig(attack, stored, false).smtpPassword, stored.smtpPassword)
  for (const field of ['smtpHost', 'smtpUsername', 'smtpPort', 'smtpSecure']) {
    const changed = { ...stored, smtpPassword: SMTP_PASSWORD_MASK, [field]: field === 'smtpPort' ? 25 : field === 'smtpSecure' ? false : 'other' }
    assert.throws(() => resolveSmtpTestConfig(changed, stored, true), { statusCode: 400 })
  }
  assert.equal(resolveSmtpTestConfig({ ...stored, smtpPassword: SMTP_PASSWORD_MASK }, stored, true).smtpPassword, 'saved-secret')
  assert.equal(resolveSmtpTestConfig({ ...attack, smtpPassword: 'new-secret' }, stored, true).smtpPassword, 'new-secret')
})

test('仅分配角色的接口路径不允许修改资料、状态或密码，成功时只更新角色', async () => {
  const target = { id: 7, name: '测试用户', username: 'test', grade: '高一', class: '1班', role: 'USER', status: 'active', permissions: null }
  const operator = { id: 9, role: 'TEST', perms: role('users:assign-role') }
  const saved: any[] = [], checks: string[] = []
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ ...target }] }) }) }),
    update: () => ({ set: (patch: any) => ({ where: () => ({ returning: async () => { saved.push(patch); return [{ ...target, ...patch }] } }) }) })
  }
  const route = handler('server/api/admin/users/[id].put.ts', {
    ...permissions, createError, createApiError, SERVER_ERROR_CODES,
    users: { id: 'id', username: 'username' }, eq: () => null,
    defineEventHandler: (fn: any) => fn, readBody: async (event: any) => event.body,
    getRouterParam: () => String(target.id),
    withPermissionTransaction: async (event: any, callback: any) => {
      const guard = resolvePermissionRouteGuard('/api/admin/users/7', 'PUT')!
      assert.ok(permissions.hasAllPermissions(event.context.user.perms, guard.all))
      assert.ok(permissions.hasAnyPermission(event.context.user.perms, guard.any))
      return callback(tx, { TEST: [], USER: [] })
    },
    assertProtectedCodesAfterAccountChange: async () => { checks.push('protected') },
    assertAccountPermissionExpansion: () => { checks.push('expansion') },
    assertSuperAdminRoleChangeAllowed: async () => {},
    assertSuperAdminCountAfterAccountChange: async () => {},
    recordSuperAdminRoleChange: async () => {},
    createSystemNotification: async () => {}
  })
  for (const extra of [{ name: '篡改' }, { status: 'withdrawn' }, { password: 'new-password' }, { grade: '高三' }]) {
    await assert.rejects(route({ body: { role: 'TEST', ...extra }, context: { user: operator } }), { statusCode: 403 })
  }
  assert.equal(saved.length, 0)
  const response = await route({ body: { role: 'TEST' }, context: { user: operator } })
  assert.equal(response.success, true)
  assert.deepEqual(saved, [{ role: 'TEST' }])
  assert.deepEqual(checks, ['protected', 'expansion'])
})

test('分配角色的替代准入仅匹配用户 ID，不能放行批量状态或其他用户管理接口', () => {
  const perms = role('users:assign-role')
  for (const [path, method, allowed] of [
    ['/api/admin/users/7', 'PUT', true],
    ['/api/admin/users/batch-status', 'PUT', false],
    ['/api/admin/users/7/status', 'PUT', false],
    ['/api/admin/users/batch-update', 'POST', false],
    ['/api/admin/users/7/reset-password', 'POST', false],
    ['/api/admin/users/7', 'DELETE', false],
    ['/api/admin/users/7abc', 'PUT', false]
  ] as const) {
    const guard = resolvePermissionRouteGuard(path, method)!
    assert.equal(!guard.deny && permissions.hasAllPermissions(perms, guard.all) && permissions.hasAnyPermission(perms, guard.any), allowed, `${method} ${path}`)
  }
})

test('SMTP 测试接口仅使用隔离实例，关闭测试传输器且不改写全局服务', async () => {
  const calls: string[] = []
  const stored = { smtpEnabled: true, smtpHost: 'mail.school.example', smtpUsername: 'school', smtpPassword: 'stored-secret' }
  for (const mode of ['connection', 'email']) {
    const route = handler(`server/api/admin/smtp/test-${mode}.post.ts`, {
      defineEventHandler: (fn: any) => fn,
      readBody: async () => ({ testEmail: 'test@example.com', smtpHost: 'attacker.example', smtpPassword: SMTP_PASSWORD_MASK }),
      getSystemSettingsCached: async () => stored,
      getClientIP: () => '127.0.0.1', hasAdminPermission: permissions.hasAdminPermission, resolveSmtpTestConfig,
      SmtpService: {
        getInstance: () => { throw new Error('测试不得使用全局邮件实例') },
        createTestInstance: (config: any) => {
          assert.equal(config.smtpHost, stored.smtpHost)
          assert.equal(config.smtpPassword, stored.smtpPassword)
          return {
            transporter: { close: () => calls.push('close') },
            testConnection: async () => ({ success: true }), sendTestEmail: async () => ({ success: true })
          }
        }
      }
    })
    assert.equal((await route({ context: { user: { perms: role('smtp:test') } } })).success, true)
  }
  assert.deepEqual(calls, ['close', 'close'])
})
