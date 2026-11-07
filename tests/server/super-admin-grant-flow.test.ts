import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import * as permissions from '../../app/utils/admin-permissions.ts'
import * as policy from '../../server/utils/permission-policy.ts'
import { SERVER_ERROR_CODES } from '../../server/config/constants.ts'

const consoleCode = permissions.PRIV_ADMIN_CONSOLE

const apiError = (statusCode: number, code: string, message: string, data?: unknown) =>
  Object.assign(new Error(message), { statusCode, data: { code, ...(data as object) } })
const h3Error = (data: { statusCode: number; message: string }) =>
  Object.assign(new Error(data.message), data)

const column = (key: string) => ({ key })
const table = (name: string, keys: string[]) =>
  Object.assign(Object.fromEntries(keys.map((key) => [key, column(key)])), { table: name })

const usersTable = table('users', ['id', 'role', 'status', 'username', 'name', 'password', 'permissions'])
const cardCodesTable = table('cardCodes', ['id', 'status', 'assignedTo'])
const cardAssignmentsTable = table('cardCodeAssignments', ['cardCodeId', 'status'])
const userIdentitiesTable = table('userIdentities', ['userId', 'provider', 'providerUserId'])

const eq = (field: any, value: unknown) => ({ field, value })
const noop = () => null

function compile(file: string, deps: Record<string, unknown>) {
  const source = stripTypeScriptTypes(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace('export default defineEventHandler', 'return defineEventHandler')
  return new Function(...Object.keys(deps), source)(...Object.values(deps))
}

// 事务替身：回调正常返回即视为已提交，用于断言留痕与副作用的先后
function transactionHarness(state: Record<string, any[]>) {
  const log: string[] = []
  const inserted: any[] = []
  const tx = {
    select(fields?: any) {
      let target = usersTable
      const query: any = {
        from(value: any) {
          target = value
          return query
        },
        where: () => query,
        limit: () => query,
        orderBy: () => query,
        for: () => query,
        then(resolve: any, reject: any) {
          const rows = state[target.table] ?? []
          return Promise.resolve(
            rows.map((row: any) =>
              fields
                ? Object.fromEntries(
                    Object.entries(fields).map(([name, field]: any) => [name, row[field.key]])
                  )
                : { ...row }
            )
          ).then(resolve, reject)
        }
      }
      return query
    },
    update(target: any) {
      return { set: () => ({ where: async () => log.push(`update:${target.table}`) }) }
    },
    delete(target: any) {
      return {
        where: async () => {
          state[target.table] = []
          log.push(`delete:${target.table}`)
        }
      }
    },
    insert(target: any) {
      return {
        values: (record: any) => ({
          returning: async () => {
            inserted.push(record)
            log.push(`insert:${target.table}`)
            return [{ id: 42, ...record }]
          }
        })
      }
    }
  }
  const withPermissionTransaction = async (_event: any, callback: any) => {
    const result = await callback(tx, { SUPER_ADMIN: ['*'], USER: [], ADMIN: [] })
    log.push('commit')
    return result
  }
  return { log, inserted, tx, withPermissionTransaction }
}

const superActor = {
  id: 1,
  role: 'SUPER_ADMIN',
  name: '超级管理员',
  username: 'admin',
  perms: [consoleCode, '*'],
  sessionId: 'session-a'
}

function deleteHandler(options: {
  state?: Record<string, any[]>
  stepUp?: 'allow' | 'deny'
  actor?: any
} = {}) {
  const state = options.state ?? {
    users: [{ id: 3, role: 'SUPER_ADMIN', status: 'active', username: 'second', name: '副超管' }],
    cardCodes: [],
    cardCodeAssignments: []
  }
  const h = transactionHarness(state)
  const calls: string[] = []
  const handler = compile('server/api/admin/users/[id].delete.ts', {
    defineEventHandler: (fn: any) => fn,
    getRouterParam: () => '3',
    createApiError: apiError,
    SERVER_ERROR_CODES,
    getServerDate: () => new Date(0),
    users: usersTable,
    cardCodes: cardCodesTable,
    cardCodeAssignments: cardAssignmentsTable,
    and: noop,
    asc: noop,
    eq,
    inArray: noop,
    withPermissionTransaction: h.withPermissionTransaction,
    assertProtectedCodesAfterAccountChange: async () => {
      calls.push('protected')
    },
    assertSuperAdminCountAfterAccountChange: async () => {
      calls.push('count')
    },
    assertSuperAdminRoleChangeAllowed: async (_event: any, operator: any, previousRole: any, nextRole: any) => {
      if (!permissions.isSuperAdminRoleTransition(previousRole, nextRole)) return
      calls.push('step-up')
      if (options.stepUp === 'deny') {
        throw apiError(403, SERVER_ERROR_CODES.PERMISSION_STEP_UP_REQUIRED, '需要二次验证')
      }
    },
    recordSuperAdminRoleChange: async () => {
      calls.push('revoke-audit')
      h.log.push('revoke-audit')
    },
    ...permissions
  })
  const event = { context: { user: options.actor ?? superActor } }
  return { handler, event, calls, log: h.log, state }
}

test('删除超管：验证与留痕顺序正确，提交后才写审计', async () => {
  const r = deleteHandler()
  const result = await r.handler(r.event)
  assert.equal(result.success, true)
  // 先卡二次验证，再查能力安全阀与数量下限
  assert.deepEqual(r.calls.slice(0, 3), ['step-up', 'protected', 'count'])
  assert.deepEqual(r.log, ['delete:users', 'commit', 'revoke-audit'])
})

test('删除超管：缺少二次验证窗口时拦住，且不写库也不留痕', async () => {
  const r = deleteHandler({ stepUp: 'deny' })
  await assert.rejects(r.handler(r.event), {
    statusCode: 403,
    data: { code: SERVER_ERROR_CODES.PERMISSION_STEP_UP_REQUIRED }
  })
  assert.deepEqual(r.calls, ['step-up'])
  assert.equal(r.log.length, 0, '拦住后不应发生任何写入或提交')
  assert.equal(r.state.users.length, 1, '超管账号不应被删除')
})

test('删除普通用户不触发超管留痕', async () => {
  const r = deleteHandler({
    state: {
      users: [{ id: 3, role: 'USER', status: 'active', username: 'student', name: '学生' }],
      cardCodes: [],
      cardCodeAssignments: []
    }
  })
  assert.equal((await r.handler(r.event)).success, true)
  assert.ok(!r.calls.includes('step-up'))
  assert.ok(!r.log.includes('revoke-audit'))
})

function createHandler(options: { role?: string; actor?: any; stepUp?: 'allow' | 'deny' } = {}) {
  const state = { users: [] as any[] }
  const h = transactionHarness(state)
  const calls: string[] = []
  const handler = compile('server/api/admin/users/index.post.ts', {
    defineEventHandler: (fn: any) => fn,
    readBody: async (event: any) => event.body,
    createApiError: apiError,
    createError: h3Error,
    SERVER_ERROR_CODES,
    users: usersTable,
    eq,
    bcrypt: { hash: async (value: string) => `hashed:${value}` },
    getAdminPasswordViolation: () => null,
    withPermissionTransaction: h.withPermissionTransaction,
    assertAccountPermissionExpansion: () => {
      calls.push('expansion')
    },
    assertSuperAdminCountInvariant: async () => {
      calls.push('count')
    },
    assertSuperAdminRoleChangeAllowed: async (_event: any, operator: any, previousRole: any, nextRole: any) => {
      if (!permissions.isSuperAdminRoleTransition(previousRole, nextRole)) return
      calls.push('step-up')
      if (options.stepUp === 'deny') {
        throw apiError(403, SERVER_ERROR_CODES.PERMISSION_STEP_UP_REQUIRED, '需要二次验证')
      }
    },
    recordSuperAdminRoleChange: async () => {
      calls.push('grant-audit')
      h.log.push('grant-audit')
    },
    recordAdminAudit: async () => {},
    ...permissions,
    ...policy
  })
  const event = {
    body: {
      name: '新管理员',
      username: 'newadmin',
      password: 'Passw0rd!',
      role: options.role ?? 'SUPER_ADMIN',
      status: 'active'
    },
    context: { user: options.actor ?? superActor }
  }
  return { handler, event, calls, log: h.log, inserted: h.inserted }
}

test('新建超管：强制首登改密，审计留痕在事务提交之后', async () => {
  const r = createHandler()
  const result = await r.handler(r.event)
  assert.equal(result.success, true)
  assert.equal(r.inserted[0].role, 'SUPER_ADMIN')
  assert.equal(r.inserted[0].forcePasswordChange, true)
  assert.deepEqual(r.log, ['insert:users', 'commit', 'grant-audit'])
})

test('新建超管：非超管操作者与缺少验证窗口均拦住且不写库', async () => {
  const outsider = createHandler({
    actor: { ...superActor, role: 'ADMIN', perms: [consoleCode, 'users:assign-role', 'users:write'] }
  })
  await assert.rejects(outsider.handler(outsider.event), { statusCode: 403 })
  assert.equal(outsider.inserted.length, 0)
  assert.equal(outsider.log.length, 0)

  const unverified = createHandler({ stepUp: 'deny' })
  await assert.rejects(unverified.handler(unverified.event), {
    statusCode: 403,
    data: { code: SERVER_ERROR_CODES.PERMISSION_STEP_UP_REQUIRED }
  })
  assert.equal(unverified.inserted.length, 0)
  assert.ok(!unverified.log.includes('grant-audit'))

  // 普通角色沿用既有口径：不涉及超管身份，无需二次验证
  const normal = createHandler({ role: 'USER' })
  assert.equal((await normal.handler(normal.event)).success, true)
  assert.ok(!normal.calls.includes('step-up'))
})

function stepUpEndpoint(options: {
  reason?: string
  password?: string
  code?: string
  perms?: string[]
  totp?: boolean
  passwordValid?: boolean
  codeValid?: boolean
  rateLimited?: boolean
} = {}) {
  const calls: string[] = []
  const operator = { id: 1, perms: options.perms ?? [consoleCode] }
  const handler = compile('server/api/auth/step-up.post.ts', {
    defineEventHandler: (fn: any) => fn,
    readBody: async (event: any) => event.body,
    setResponseHeader: () => {},
    createApiError: apiError,
    SERVER_ERROR_CODES,
    db: {
      select() {
        const query: any = {
          from: () => query,
          where: () => query,
          limit: () => query,
          then: (resolve: any) =>
            Promise.resolve([{ id: 1, password: 'stored-hash', status: 'active' }]).then(resolve)
        }
        return query
      },
      query: {
        userIdentities: {
          findFirst: async () =>
            options.totp ? { provider: 'totp', providerUserId: 'SECRET' } : undefined
        }
      }
    },
    users: usersTable,
    userIdentities: userIdentitiesTable,
    and: noop,
    eq: noop,
    bcrypt: {
      compare: async () => {
        calls.push('bcrypt')
        return options.passwordValid !== false
      }
    },
    otplib: {
      authenticator: {
        check: () => {
          calls.push('totp')
          return options.codeValid !== false
        }
      }
    },
    getClientIP: () => '203.0.113.7',
    delStore: async () => {},
    incrStore: async () => 1,
    hasPermission: permissions.hasPermission,
    PRIV_ADMIN_CONSOLE: consoleCode,
    PASSWORD_AUDIT_ACTIONS: { STEP_UP: 'STEP_UP' },
    consumePasswordRateLimit: async () => {
      calls.push('rate-limit')
      return options.rateLimited
        ? { allowed: false, retryAfterSeconds: 600 }
        : { allowed: true, retryAfterSeconds: 0 }
    },
    recordPasswordAudit: async (_event: any, _id: number, _action: string, success: boolean) => {
      calls.push(success ? 'audit-success' : 'audit-failure')
    },
    STEP_UP_TOTP_FAILURE_LIMIT: 5,
    STEP_UP_TOTP_FAILURE_WINDOW_SECONDS: 300,
    isStepUpReason: (reason: unknown) => reason === 'super-admin-role',
    issueStepUpWindow: async () => {
      calls.push('issue-window')
      return 300
    }
  })
  const event = {
    body: {
      reason: options.reason ?? 'super-admin-role',
      password: options.password ?? 'Passw0rd!',
      code: options.code
    },
    context: { user: operator }
  }
  return { handler, event, calls }
}

test('二次验证端点：频控与白名单先于密码校验，失败不留窗口', async () => {
  const limited = stepUpEndpoint({ rateLimited: true })
  await assert.rejects(limited.handler(limited.event), { statusCode: 429 })
  assert.deepEqual(limited.calls, ['rate-limit', 'audit-failure'], '超限时不应调用 bcrypt')

  const badReason = stepUpEndpoint({ reason: 'database-reset' })
  await assert.rejects(badReason.handler(badReason.event), {
    statusCode: 400,
    data: { code: SERVER_ERROR_CODES.PERMISSION_STEP_UP_REASON_INVALID }
  })
  assert.equal(badReason.calls.length, 0)

  const outsider = stepUpEndpoint({ perms: ['users:write'] })
  await assert.rejects(outsider.handler(outsider.event), { statusCode: 403 })
  assert.equal(outsider.calls.length, 0)

  const wrongPassword = stepUpEndpoint({ passwordValid: false })
  await assert.rejects(wrongPassword.handler(wrongPassword.event), {
    statusCode: 403,
    data: { code: SERVER_ERROR_CODES.PERMISSION_STEP_UP_FAILED }
  })
  assert.ok(wrongPassword.calls.includes('bcrypt'))
  assert.ok(wrongPassword.calls.includes('audit-failure'))
  assert.ok(!wrongPassword.calls.includes('issue-window'), '凭据错误不应签发窗口')
})

test('二次验证端点：已绑定认证器时必须动态码，校验通过才签发窗口', async () => {
  const missingCode = stepUpEndpoint({ totp: true })
  await assert.rejects(missingCode.handler(missingCode.event), {
    statusCode: 400,
    data: { code: SERVER_ERROR_CODES.AUTH_MISSING_REQUIRED_PARAMS }
  })
  assert.ok(missingCode.calls.includes('audit-failure'))
  assert.ok(!missingCode.calls.includes('issue-window'))

  const badCode = stepUpEndpoint({ totp: true, code: '000000', codeValid: false })
  await assert.rejects(badCode.handler(badCode.event), {
    statusCode: 400,
    data: { code: SERVER_ERROR_CODES.AUTH_TOTP_CODE_INVALID }
  })
  assert.ok(!badCode.calls.includes('issue-window'))

  const okWithCode = stepUpEndpoint({ totp: true, code: '123456' })
  const result = await okWithCode.handler(okWithCode.event)
  assert.deepEqual(result, { success: true, reason: 'super-admin-role', expiresIn: 300 })
  assert.ok(okWithCode.calls.includes('issue-window'))

  const okNoTotp = stepUpEndpoint()
  assert.equal((await okNoTotp.handler(okNoTotp.event)).success, true)
  assert.ok(!okNoTotp.calls.includes('totp'))
})
