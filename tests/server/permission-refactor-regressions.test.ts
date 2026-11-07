import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { computed, ref } from 'vue'
import * as permissions from '../../app/utils/admin-permissions.ts'
import * as policy from '../../server/utils/permission-policy.ts'
import { resolvePermissionRouteGuard } from '../../server/utils/admin-permission-routes.ts'
import { SERVER_ERROR_CODES } from '../../server/config/constants.ts'

const {
  hasPermission,
  hasAdminPermission,
  resolveEffectivePermissions,
  toggleExplicitPermission,
  ROLE_PERMISSION_TEMPLATES_DEFAULT: defaults,
  PRIV_ADMIN_CONSOLE: consoleCode,
  PRIV_ROLE_TEMPLATE: templateCode,
  PRIV_GRANT: grantCode
} = permissions

function evaluate(file: string, dependencies: Record<string, unknown>, names: string[]) {
  const source = stripTypeScriptTypes(
    readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
  )
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace(/import\.meta\.server/g, 'false')
    .replace(/import\.meta\.client/g, 'true')
    .replace(/\bexport /g, '')
  return new Function(...Object.keys(dependencies), `${source}; return { ${names.join(',')} }`)(
    ...Object.values(dependencies)
  )
}

const apiError = (statusCode: number, code: string, message: string, data?: unknown) =>
  Object.assign(new Error(message), { statusCode, data: { code, ...(data as object) } })
const h3Error = (data: { statusCode: number; message: string }) =>
  Object.assign(new Error(data.message), data)
const users = Object.assign(
  Object.fromEntries(
    [
      'id',
      'role',
      'status',
      'permissions',
      'name',
      'username',
      'tokenVersion',
      'forcePasswordChange'
    ].map((key) => [key, { key }])
  ),
  { table: 'users' }
)
const settings = { table: 'settings', rolePermissionTemplates: { key: 'rolePermissionTemplates' } }
const eq = (field: { key: string }, value: unknown) => (row: any) => row[field.key] === value

function runtime(rows: any[], templates: any = defaults) {
  let state = { users: structuredClone(rows), settings: [{ rolePermissionTemplates: templates }] }
  let tail = Promise.resolve()
  const events: string[] = []
  const executor = (acquire?: () => Promise<void>) => ({
    async execute() {
      assert.ok(acquire)
      await acquire()
      events.push('lock')
    },
    select(fields?: any) {
      let table = 'users',
        predicate = (_: any) => true,
        limit = Infinity
      const query = {
        from(value: any) {
          table = value.table
          return query
        },
        where(value: any) {
          predicate = value
          return query
        },
        limit(value: number) {
          limit = value
          return query
        },
        for() {
          return query
        },
        then(resolve: any, reject: any) {
          events.push(`read:${table}`)
          const result = (state as any)[table]
            .filter(predicate)
            .slice(0, limit)
            .map((row: any) =>
              fields
                ? Object.fromEntries(
                    Object.entries(fields).map(([name, field]: any) => [name, row[field.key]])
                  )
                : { ...row }
            )
          return Promise.resolve(result).then(resolve, reject)
        }
      }
      return query
    },
    update(value: any) {
      let patch: any
      return {
        set(next: any) {
          patch = next
          return this
        },
        async where(predicate: any) {
          for (const row of (state as any)[value.table].filter(predicate)) Object.assign(row, patch)
        }
      }
    },
    delete(value: any) {
      return {
        async where(predicate: any) {
          ;(state as any)[value.table] = (state as any)[value.table].filter(
            (row: any) => !predicate(row)
          )
        }
      }
    },
    insert() {
      throw new Error('此场景不应插入数据')
    }
  })
  const db = {
    ...executor(),
    async transaction(callback: any) {
      let release: (() => void) | undefined
      let snapshot: typeof state | undefined
      const tx = executor(async () => {
        const previous = tail
        tail = new Promise<void>((resolve) => {
          release = resolve
        })
        await previous
        snapshot = structuredClone(state)
      })
      try {
        return await callback(tx)
      } catch (error) {
        if (snapshot) state = snapshot
        throw error
      } finally {
        release?.()
      }
    }
  }
  const getTemplates = evaluate(
    'server/utils/system-settings-helper.ts',
    {
      db,
      systemSettings: settings,
      ROLE_PERMISSION_TEMPLATES_DEFAULT: defaults,
      validateRoleTemplates: policy.validateRoleTemplates,
      createApiError: apiError,
      SERVER_ERROR_CODES
    },
    ['getRolePermissionTemplatesCached']
  ).getRolePermissionTemplatesCached
  const admin = evaluate(
    'server/utils/permission-admin.ts',
    {
      db,
      systemSettings: settings,
      users,
      eq,
      sql: () => ({}),
      getRequestURL: (event: any) => new URL(event.path, 'http://localhost'),
      createApiError: apiError,
      SERVER_ERROR_CODES,
      SYSTEM_SETTINGS_DEFAULTS: {},
      getRolePermissionTemplatesCached: getTemplates,
      getSystemSettingsCached: async () => state.settings[0],
      ...permissions,
      ...policy,
      resolvePermissionRouteGuard
    },
    [
      'withPermissionTransaction',
      'loadPermissionHolderRows',
      'assertProtectedCodesAfterAccountChange',
      'assertProtectedCodesAfterAccountChanges',
      'assertGrantChangesWithinOperator',
      'normalizeSubmittedGrants',
      'assertAccountPermissionExpansion',
      'assertAccountCredentialsWithinOperator',
      'assertRoleTemplateExpansionWithinOperator'
    ]
  )
  const event = (id: number, path: string, method = 'PUT') => {
    const row = state.users.find((item) => item.id === id)
    return {
      path,
      method,
      context: { user: { ...row, perms: resolveEffectivePermissions(row, templates) } }
    }
  }
  return { db, admin, getTemplates, event, events, rows: () => state.users }
}

function handler(file: string, deps: Record<string, unknown>) {
  const source = stripTypeScriptTypes(
    readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
  )
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace('export default defineEventHandler', 'return defineEventHandler')
  return new Function(...Object.keys(deps), source)(...Object.values(deps))
}

const baseDeps = {
  users,
  eq,
  defineEventHandler: (fn: any) => fn,
  getRouterParam: (event: any) => event.id,
  readBody: (event: any) => event.body,
  createApiError: apiError,
  createError: h3Error,
  SERVER_ERROR_CODES,
  ...permissions,
  recordAdminAudit: async () => {}
}

test('通配授权不能恢复操作者被显式拒绝的能力', () => {
  assert.deepEqual(policy.findGrantsBeyondOperator(['songs:*'], ['songs:*', '!songs:delete']), [
    'songs:*'
  ])
  assert.deepEqual(policy.findGrantsBeyondOperator(['*'], ['*', '!backup:restore']), ['*'])
  assert.deepEqual(policy.findGrantsBeyondOperator(['songs:*'], ['songs:*']), [])
})

test('恢复模板和移除拒绝项同样校验授权上界', () => {
  for (const next of [null, []]) {
    assert.deepEqual(policy.findGrantChangesBeyondOperator(['!users:delete'], next, ['songs:*']), [
      '!users:delete'
    ])
  }
  assert.deepEqual(
    policy.findGrantChangesBeyondOperator(
      ['songs:read', 'users:read'],
      ['songs:read', 'users:read', 'songs:write'],
      ['songs:*']
    ),
    []
  )
})

test('模板编辑不能新增或恢复操作者未持有的权限', () => {
  const previous = { ...defaults, USER: [consoleCode, templateCode] }
  const next = { ...previous, USER: ['*'] }
  assert.ok(
    policy.findRoleTemplateChangesBeyondOperator(previous, next, [consoleCode, templateCode]).length
  )
  assert.deepEqual(
    policy.findRoleTemplateChangesBeyondOperator(previous, previous, [consoleCode, templateCode]),
    []
  )
})

test('显式权限可反复切换，并支持通配授予和通配拒绝', () => {
  for (const template of [[], ['songs:write']]) {
    let explicit: string[] = []
    explicit = toggleExplicitPermission(template, explicit, 'songs:write')
    assert.equal(
      hasPermission([...template, ...explicit], 'songs:write'),
      !hasPermission(template, 'songs:write')
    )
    explicit = toggleExplicitPermission(template, explicit, 'songs:write')
    assert.equal(
      hasPermission([...template, ...explicit], 'songs:write'),
      hasPermission(template, 'songs:write')
    )
  }
  let wildcard = toggleExplicitPermission([], ['*'], 'songs:write')
  assert.equal(hasPermission(wildcard, 'songs:write'), false)
  wildcard = toggleExplicitPermission([], wildcard, 'songs:write')
  assert.deepEqual(wildcard, ['*'])
  const restored = toggleExplicitPermission(['songs:*'], ['!songs:*'], 'songs:write')
  assert.equal(hasPermission(['songs:*', ...restored], 'songs:write'), true)
  assert.equal(hasPermission(['songs:*', ...restored], 'songs:delete'), false)
})

test('USER 模板持有者纳入实际数据库查询和最后持有者保护', async () => {
  const templates = {
    ...defaults,
    USER: [consoleCode, templateCode],
    SUPER_ADMIN: [consoleCode, grantCode, 'users:delete']
  }
  const r = runtime(
    [
      { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: null },
      { id: 2, role: 'USER', status: 'active', permissions: null }
    ],
    templates
  )
  const rows = await r.admin.loadPermissionHolderRows()
  assert.equal(rows.length, 2)
  assert.deepEqual(policy.collectCodeHolders(rows, templates, [templateCode])[templateCode], [2])
  await assert.rejects(
    r.admin.withPermissionTransaction(
      r.event(1, '/api/admin/users/2', 'DELETE'),
      (tx: any, current: any) =>
        r.admin.assertProtectedCodesAfterAccountChange(2, null, 1, tx, current)
    ),
    { statusCode: 403 }
  )
})

test('并发移除两个持有者只允许一个提交，事务锁覆盖读取与写入', async () => {
  const r = runtime([
    { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: [`!${templateCode}`] },
    { id: 2, role: 'ADMIN', status: 'active', permissions: [templateCode] },
    { id: 3, role: 'ADMIN', status: 'active', permissions: [templateCode] }
  ])
  const remove = (id: number) =>
    r.admin.withPermissionTransaction(
      r.event(1, `/api/admin/users/${id}`, 'DELETE'),
      async (tx: any, templates: any) => {
        await r.admin.assertProtectedCodesAfterAccountChange(id, null, 1, tx, templates)
        await tx.delete(users).where(eq(users.id, id))
      }
    )
  const results = await Promise.allSettled([remove(2), remove(3)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(
    policy.collectCodeHolders(r.rows(), defaults, [templateCode])[templateCode].length,
    1
  )
  assert.equal(r.events[0], 'lock')
})

test('等待锁期间被撤权的操作者不能继续提交', async () => {
  const r = runtime([
    { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: null },
    { id: 2, role: 'USER', status: 'active', permissions: [consoleCode, 'users:write'] }
  ])
  const staleEvent = r.event(2, '/api/admin/users/42')
  const revoke = r.admin.withPermissionTransaction(
    r.event(1, '/api/admin/users/2/permissions'),
    async (tx: any) => {
      await tx.update(users).set({ permissions: [] }).where(eq(users.id, 2))
    }
  )
  let executed = false
  const staleWrite = r.admin.withPermissionTransaction(staleEvent, async () => {
    executed = true
  })
  await revoke
  await assert.rejects(staleWrite, { statusCode: 403 })
  assert.equal(executed, false)
})

test('按用户授权接口阻止通过 null 清除未持有权限的拒绝项', async () => {
  const r = runtime([
    { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: null },
    { id: 2, role: 'ADMIN', status: 'active', permissions: ['!users:delete'] },
    { id: 3, role: 'SONG_ADMIN', status: 'active', permissions: [grantCode] }
  ])
  const put = handler('server/api/admin/users/[id]/permissions.put.ts', { ...baseDeps, ...r.admin })
  const event = {
    ...r.event(3, '/api/admin/users/2/permissions'),
    id: '2',
    body: { permissions: null }
  }
  await assert.rejects(put(event), { statusCode: 403 })
  assert.deepEqual(r.rows().find((row) => row.id === 2).permissions, ['!users:delete'])
})

test('资料编辑接口不能绕过独立密码重置权限', async () => {
  const r = runtime([
    { id: 3, role: 'ADMIN', status: 'active', permissions: ['!users:reset-password'] },
    {
      id: 42,
      role: 'USER',
      status: 'active',
      permissions: null,
      name: 'target',
      username: 'target'
    }
  ])
  let changed = false
  const put = handler('server/api/admin/users/[id].put.ts', {
    ...baseDeps,
    ...r.admin,
    getServerDate: () => new Date(),
    getAdminPasswordViolation: () => null,
    updateUserPassword: async () => {
      changed = true
    },
    createSystemNotification: async () => {},
    PASSWORD_AUDIT_ACTIONS: {},
    getPasswordAuditContext: () => ({})
  })
  const event = {
    ...r.event(3, '/api/admin/users/42'),
    id: '42',
    body: { name: 'target', username: 'target', password: 'Temporary123!' }
  }
  await assert.rejects(put(event), { statusCode: 403 })
  assert.equal(changed, false)
})

test('旧管理接口与新接口使用相同权限码，普通用户业务入口不被整体拦截', () => {
  for (const [path, method, code] of [
    ['/api/songs/add', 'POST', 'songs:write'],
    ['/api/songs/42/update', 'PUT', 'songs:write'],
    ['/api/songs/42/voters', 'GET', 'songs:read'],
    ['/api/system/status', 'GET', 'system:read'],
    ['/api/system/reconnect', 'POST', 'database:read']
  ]) {
    const guard = resolvePermissionRouteGuard(path, method)!
    assert.ok(guard && !guard.fallback && !guard.deny)
    assert.deepEqual(guard.any, [code])
    assert.equal(
      permissions.hasAllPermissions([consoleCode, `!${code}`], guard.all) &&
        permissions.hasAnyPermission([consoleCode, `!${code}`], guard.any),
      false
    )
  }
  for (const path of [
    '/api/songs/request',
    '/api/songs/withdraw',
    '/api/songs/public',
    '/api/card-codes/validate'
  ]) {
    assert.equal(resolvePermissionRouteGuard(path, 'POST'), null)
  }
})

test('删除邮件模板与清空数据库不隐含在普通写权限内', () => {
  assert.deepEqual(resolvePermissionRouteGuard('/api/admin/email-templates', 'DELETE')!.any, [
    'email-templates:delete'
  ])
  assert.deepEqual(resolvePermissionRouteGuard('/api/admin/backup/clear', 'POST')!.any, [
    'database:reset'
  ])
  assert.equal(resolvePermissionRouteGuard('/api/admin/new-secret', 'GET')!.deny, true)
})

test('后台能力必须同时包含后台准入与对应动作', () => {
  assert.equal(hasAdminPermission({ perms: ['songs:write'] }, 'songs:write'), false)
  assert.equal(hasAdminPermission({ perms: [consoleCode, 'songs:write'] }, 'songs:write'), true)
  assert.equal(
    hasAdminPermission({ perms: [consoleCode, 'songs:*', '!songs:write'] }, 'songs:write'),
    false
  )
  assert.equal(hasAdminPermission(undefined, 'songs:write'), false)
})

test('权限配置读取失败或内容损坏时不得恢复默认权限', async () => {
  const r = runtime([], [])
  await assert.rejects(r.getTemplates(), { statusCode: 503 })
  await assert.rejects(
    r.getTemplates({
      select() {
        throw new Error('timeout')
      }
    }),
    /timeout/
  )
  const normal = runtime([], null)
  assert.deepEqual(await normal.getTemplates(), defaults)
})

test('前端后台入口根据有效权限而不是身份判断', () => {
  const states = new Map<string, unknown>()
  const module = evaluate(
    'app/composables/useAuth.ts',
    {
      navigateTo: async () => {},
      computed,
      canAccessAdminConsole: permissions.canAccessAdminConsole,
      useState: (key: string, initial: () => unknown) => {
        if (!states.has(key)) states.set(key, ref(initial()))
        return states.get(key)
      },
      useUserFilters: () => ({}),
      useServerErrors: () => ({ localize: () => '' })
    },
    ['useAuth']
  )
  const auth = module.useAuth()
  auth.setAuthState({
    id: 2,
    role: 'USER',
    perms: [consoleCode, 'page:playtimes', 'play-times:read']
  })
  assert.equal(auth.isAdmin.value, true)
  const access = evaluate(
    'app/composables/usePermissions.ts',
    {
      computed,
      useAuth: () => auth,
      ...permissions
    },
    ['usePermissions']
  ).usePermissions()
  assert.equal(access.canAccessAdmin.value, true)
  assert.equal(access.can('play-times:read'), true)
  assert.equal(access.can('play-times:write'), false)
  assert.equal(access.isUser.value, true)
  auth.setAuthState({ id: 3, role: 'ADMIN', perms: [] })
  assert.equal(auth.isAdmin.value, false)
  assert.equal(access.canAccessAdmin.value, false)
})

test('有限具体授权不能授出覆盖未来权限的通配符', () => {
  const songs = permissions.ADMIN_PERMISSION_CODES.filter((code) => code.startsWith('songs:'))
  assert.deepEqual(policy.findGrantsBeyondOperator(['songs:*'], songs), ['songs:*'])
  assert.deepEqual(policy.findGrantsBeyondOperator(['*'], permissions.ADMIN_PERMISSION_CODES), [
    '*'
  ])
})

test('单个状态接口不能停用唯一的 USER 模板权限持有者', async () => {
  const r = runtime([
    { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: [`!${templateCode}`] },
    { id: 2, role: 'USER', status: 'active', permissions: [consoleCode, templateCode] }
  ])
  const put = handler('server/api/admin/users/[id]/status.put.ts', {
    ...baseDeps,
    ...r.admin,
    userStatusLogs: {},
    getStatusText: (s: string) => s,
    getServerDate: () => new Date()
  })
  const event = {
    ...r.event(1, '/api/admin/users/2/status'),
    id: '2',
    body: { status: 'graduate', reason: 'test' }
  }
  await assert.rejects(put(event), { statusCode: 403 })
  assert.equal(r.rows().find((row) => row.id === 2).status, 'active')
})

test('批量状态接口按整批结果保护最后持有者，拒绝时全部回滚', async () => {
  const r = runtime([
    { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: [`!${templateCode}`] },
    { id: 2, role: 'ADMIN', status: 'active', permissions: [templateCode] },
    { id: 3, role: 'ADMIN', status: 'active', permissions: [templateCode] }
  ])
  const put = handler('server/api/admin/users/batch-status.put.ts', {
    ...baseDeps,
    ...r.admin,
    userStatusLogs: {},
    getStatusText: (s: string) => s,
    getServerDate: () => new Date(),
    inArray: (column: any, values: unknown[]) => (row: any) => values.includes(row[column.key])
  })
  const event = {
    ...r.event(1, '/api/admin/users/batch-status'),
    body: { userIds: [2, 3], status: 'graduate', reason: 'test' }
  }
  await assert.rejects(put(event), { statusCode: 403 })
  assert.equal(r.rows().filter((row) => row.status === 'active').length, 3)
})

test('等待锁期间会话版本被撤销后不能继续变更权限', async () => {
  const r = runtime([
    { id: 1, role: 'SUPER_ADMIN', status: 'active', permissions: null, tokenVersion: 0 }
  ])
  const stale = r.event(1, '/api/admin/users/42')
  const revoke = r.admin.withPermissionTransaction(
    r.event(1, '/api/admin/users/42'),
    async (tx: any) => {
      await tx.update(users).set({ tokenVersion: 1 }).where(eq(users.id, 1))
    }
  )
  let executed = false
  const pending = r.admin.withPermissionTransaction(stale, async () => {
    executed = true
  })
  await revoke
  await assert.rejects(pending, { statusCode: 403 })
  assert.equal(executed, false)
})

test('密码重置复用权限事务，不再申请第二个数据库连接', async () => {
  let updated = false,
    audited = false
  const executor = {
    update() {
      return {
        set(value: any) {
          assert.equal(value.password, 'hash')
          return this
        },
        where() {
          return this
        },
        async returning() {
          updated = true
          return [{ passwordChangedAt: new Date('2026-11-01T00:00:00Z'), tokenVersion: 2 }]
        }
      }
    },
    insert() {
      return {
        async values(value: any) {
          assert.equal(value.userId, 42)
          audited = true
        }
      }
    }
  }
  const service = evaluate(
    'server/services/userService.ts',
    {
      db: {
        transaction() {
          throw new Error('不应申请第二个事务连接')
        }
      },
      bcrypt: { hash: async () => 'hash' },
      users: { id: 'id', tokenVersion: 'tokenVersion' },
      passwordAuditLogs: {},
      eq: () => true,
      and: () => true,
      sql: () => ({}),
      getServerDate: () => new Date('2026-11-01T00:00:00Z'),
      createApiError: apiError
    },
    ['updateUserPassword']
  )
  const result = await service.updateUserPassword(42, 'Temporary123!', {
    executor,
    forceReset: true,
    auditContext: { action: 'test', actorId: 1, ipAddress: '127.0.0.1', userAgent: null }
  })
  assert.equal(updated, true)
  assert.equal(audited, true)
  assert.equal(result.tokenVersion, 2)
})

test('角色模板中的拒绝项保持优先，用户显式授予不能覆盖', () => {
  const effective = resolveEffectivePermissions(
    { role: 'USER', permissions: ['songs:write'] },
    { USER: [consoleCode, '!songs:write'] }
  )
  assert.equal(permissions.isPermissionDenied(effective, 'songs:write'), true)
  assert.equal(hasPermission(effective, 'songs:write'), false)
})

test('动态角色可由权限模板定义、校验并解析', () => {
  const custom = { ...defaults, CONTENT_EDITOR: ['priv:admin-console', 'songs:read', 'page:songs'] }
  const result = policy.validateRoleTemplates({
    CONTENT_EDITOR: ['priv:admin-console', 'songs:read', 'page:songs']
  })
  assert.equal(result.ok, true)
  assert.ok(permissions.getRoleTemplateKeys(custom).includes('CONTENT_EDITOR'))
  const effective = resolveEffectivePermissions({ role: 'CONTENT_EDITOR' }, custom)
  assert.equal(hasPermission(effective, 'songs:read'), true)
  assert.equal(hasPermission(effective, 'songs:write'), false)
})

test('动态角色键拒绝非法格式并支持安全角色分配范围', () => {
  assert.equal(permissions.isValidRoleKey('CONTENT_EDITOR'), true)
  assert.equal(permissions.isValidRoleKey('content-editor'), false)
  assert.equal(permissions.isValidRoleKey('A'), false)
  const operator = { role: 'ADMIN', perms: [consoleCode, 'users:assign-role'] }
  assert.equal(
    permissions.canAssignRole(operator, 'CONTENT_EDITOR', ['USER', 'CONTENT_EDITOR']),
    true
  )
  assert.equal(permissions.canAssignRole(operator, 'SUPER_ADMIN', ['USER', 'SUPER_ADMIN']), false)
})
