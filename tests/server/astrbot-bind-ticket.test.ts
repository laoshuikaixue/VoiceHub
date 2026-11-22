import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createApp, createRouter, eventHandler, toWebHandler } from 'h3'
import { getTableConfig } from 'drizzle-orm/pg-core'
import bcrypt from 'bcryptjs'
import otplib from 'otplib'
import { astrbotBindTickets } from '../../app/drizzle/schema.ts'
import {
  createAstrbotBindTicket, hashAstrbotBindTicket
} from '../../server/utils/astrbot-notification.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const tables = ['astrbotBindTickets', 'astrbotBindingCodes', 'astrbotBindings', 'systemSettings', 'users', 'authSessions', 'userIdentities', 'passwordAuditLogs'] as const
const fixtureModules: Record<string, string> = {
  '~~/server/utils/permission-admin': 'export const lockPermissionChanges = async () => {}',
  '~~/server/services/passwordSecurityService': [
    'export const PASSWORD_AUDIT_ACTIONS = { STEP_UP: "STEP_UP", RESET_PASSWORD: "RESET_PASSWORD" };',
    'export const consumePasswordRateLimit = async () => ({ allowed: true });',
    'export const recordPasswordAudit = async () => {};',
    'export const getPasswordAuditContext = () => ({ ipAddress: "127.0.0.1", userAgent: null });'
  ].join(' '),
  '~~/server/services/astrbotOutboxService': 'export const enqueueAstrbotNotifications = async () => {}'
}
const compiled = await build({
  stdin: {
    resolveDir: root,
    contents: `
      export { default as issue } from './server/api/bot/voicehub/bind-link.post.ts';
      export { default as read } from './server/api/notifications/astrbot/bind-ticket.get.ts';
      export { default as confirm } from './server/api/notifications/astrbot/bind-ticket.post.ts';
      export { default as unbind } from './server/api/notifications/astrbot/unbind.post.ts';
      export { default as botUnbind } from './server/api/bot/voicehub/unbind.post.ts';
      export { default as reset } from './server/api/bot/voicehub/password-reset.post.ts';
    `
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '~': `${root}/app`, '~~': root },
  plugins: [{
    name: 'bind-ticket-fixture',
    setup(plugin) {
      plugin.onResolve({ filter: /^(h3|bcryptjs|otplib|dayjs(?:\/.*)?)$/ }, ({ path }) => ({ path: import.meta.resolve(path), external: true }))
      plugin.onResolve({ filter: /passwordSecurityService|permission-admin|astrbotOutboxService/ }, ({ path }) =>
        Object.hasOwn(fixtureModules, path) ? { path, namespace: 'fixture' } : undefined)
      plugin.onResolve({ filter: /^(~\/drizzle\/(db|schema)|drizzle-orm)$/ }, ({ path }) => ({ path, namespace: 'fixture' }))
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: fixtureModules[path] ?? {
        '~/drizzle/db': `export const db = globalThis.astrbotBindTestDb`,
        '~/drizzle/schema': tables.map(table => `export const ${table} = new Proxy({ table: '${table}' }, {
          get: (object, key) => key === 'table' ? object.table : key
        });`).join('\n'),
        'drizzle-orm': `export const eq = (col, value) => row => row[col] === value;
          export const gt = (col, value) => row => row[col] > value;
          export const lte = (col, value) => row => row[col] <= value;
          export const isNull = col => row => row[col] == null;
          export const and = (...predicates) => row => predicates.every(predicate => predicate(row));
          export const sql = () => row => row.tokenVersion + 1;`
      }[path] }))
    }
  }]
})

type Row = Record<string, any>
type Records = Record<typeof tables[number], Row[]>
const botToken = 'qa-bot-token'
const umo = 'qq-instance:FriendMessage:123456'
const endpoint = '/api/notifications/astrbot/bind-ticket'
const resetEndpoint = '/api/bot/voicehub/password-reset'
const currentPassword = 'QaCurrent!2026'
const newPassword = 'QaReplacement!2026'
const currentPasswordHash = await bcrypt.hash(currentPassword, 4)
const accounts = [
  { id: 1, username: 'alice', name: 'Alice', sessionId: 'alice-session', status: 'active', tokenVersion: 0 },
  { id: 2, username: 'bob', name: 'Bob', sessionId: 'bob-session', status: 'active', tokenVersion: 0 }
]
let data: Records
let publicHost: string
let expireOnBind = false
const app = createApp({ onError: () => {} })

function project(row: Row, fields?: Record<string, string>) {
  return fields ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column]])) : { ...row }
}

function mockDb(getData: () => Records) {
  function query(table: { table: keyof Records }, op: 'select' | 'update' | 'delete', fields?: Record<string, string>) {
    let predicate = (_row: Row) => true
    let limit = Infinity
    let update: Row = {}
    const chain = {
      where(fn: typeof predicate) { predicate = fn; return chain },
      limit(count: number) { limit = count; return chain },
      for() { return chain },
      set(values: Row) { update = values; return chain },
      returning(selection?: Record<string, string>) { fields = selection; return chain },
      then(resolve: (rows: Row[]) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve().then(() => {
          const derived = getData()
          const rows = derived[table.table].filter(predicate).slice(0, limit)
          if (op === 'update') rows.forEach(row => Object.assign(row,
            Object.fromEntries(Object.entries(update).map(([key, value]) => [key, typeof value === 'function' ? value(row) : value]))))
          if (op === 'delete') derived[table.table] = derived[table.table].filter(row => !rows.includes(row))
          return rows.map(row => project(row, fields))
        }).then(resolve, reject)
      }
    }
    return chain
  }
  return {
    select: (fields?: Record<string, string>) => ({ from: (table: { table: keyof Records }) => query(table, 'select', fields) }),
    delete: (table: { table: keyof Records }) => query(table, 'delete'),
    update: (table: { table: keyof Records }) => query(table, 'update'),
    insert: (table: { table: keyof Records }) => ({ values: async (row: Row) => {
      const rows = getData()[table.table]
      if (table.table === 'astrbotBindings' && rows.some(item =>
        item.umo === row.umo || (item.userId === row.userId && item.platform === row.platform)
      )) throw Object.assign(new Error('duplicate binding'), { code: '23505' })
      if (table.table === 'astrbotBindings' && expireOnBind) {
        getData().astrbotBindTickets.forEach(ticket => { ticket.expiresAt = new Date(0) })
      }
      rows.push(row)
    } }),
    transaction: async (run: (tx: ReturnType<typeof mockDb>) => Promise<unknown>) => {
      const snapshot = structuredClone(getData())
      const result = await run(mockDb(() => snapshot))
      Object.assign(getData(), snapshot)
      return result
    }
  }
}

Object.assign(globalThis, {
  astrbotBindTestDb: mockDb(() => data),
  useRuntimeConfig: () => ({ public: { host: publicHost } })
})
const handlers = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
app.use(eventHandler(event => {
  const account = accounts.find(user => String(user.id) === event.node.req.headers['x-qa-user'])
  if (account) event.context.user = { ...account, hasSetPassword: true, sessionId: event.node.req.headers['x-qa-session'] || account.sessionId }
}))
app.use(createRouter()
  .post('/api/bot/voicehub/bind-link', handlers.issue)
  .get(endpoint, handlers.read)
  .post(endpoint, handlers.confirm)
  .post(resetEndpoint, handlers.reset)
  .post('/api/notifications/astrbot/unbind', handlers.unbind)
  .post('/api/bot/voicehub/unbind', handlers.botUnbind))
const handle = toWebHandler(app)

test.beforeEach(() => {
  expireOnBind = false
  publicHost = 'https://voicehub.example.test'
  data = {
    astrbotBindTickets: [], astrbotBindings: [], astrbotBindingCodes: [],
    systemSettings: [{ astrbotEnabled: true, astrbotToken: botToken, astrbotPlatforms: { qq: true } }],
    users: accounts.map(account => ({ ...account, role: 'USER', password: currentPasswordHash, forcePasswordChange: false })),
    userIdentities: [], passwordAuditLogs: [],
    authSessions: accounts.map(user => ({ id: user.sessionId, userId: user.id, expiresAt: new Date(Date.now() + 60_000) }))
  }
})

async function request(path: string, options: { userId?: number; sessionId?: string; body?: Row; token?: string; forwardedHost?: string } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (options.userId) headers.set('x-qa-user', String(options.userId))
  if (options.sessionId) headers.set('x-qa-session', options.sessionId)
  if (options.token) headers.set('x-voicehub-token', options.token)
  if (options.forwardedHost) headers.set('x-forwarded-host', options.forwardedHost)
  const res = await handle(new Request(`https://voicehub.example.test${path}`, {
    method: options.body ? 'POST' : 'GET', headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  }))
  return { status: res.status, headers: res.headers, body: await res.json() }
}

async function issue(target = umo) {
  const res = await request('/api/bot/voicehub/bind-link', {
    token: botToken, body: { umo: target, platform: 'aiocqhttp' }, forwardedHost: 'untrusted.example.test'
  })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.match(res.body.url, /^https:\/\/voicehub\.example\.test\/bind\/[0-9a-f]{48}$/)
  return res.body.url.split('/').at(-1)
}

const preview = (token: string, userId = 1) => request(`${endpoint}?token=${token}`, { userId })
const confirm = (token: string, confirmation: string, userId = 1, sessionId?: string) =>
  request(endpoint, { userId, sessionId, body: { token, confirmation } })

const resetPassword = (body: Row, token = botToken) =>
  request(resetEndpoint, { token, body: { umo, password: newPassword, ...body } })

test('旧绑定和普通绑定默认没有密码恢复授权', async () => {
  const token = await issue()
  const { body } = await preview(token)
  assert.equal(body.passwordResetVerification, 'password')
  assert.equal((await confirm(token, body.confirmation)).body.passwordResetGranted, false)
  for (const id of [undefined, null]) {
    data.astrbotBindings[0].passwordResetGrantId = id
    const result = await resetPassword({ step: 'init' })
    assert.equal(result.status, 403)
    assert.equal(result.body.data.code, 'ASTRBOT_PASSWORD_RESET_NOT_ALLOWED')
  }
})

test('恢复授权要求当前密码与已启用的动态验证码，并拒绝后台账号', async () => {
  const token = await issue()
  const secret = otplib.authenticator.generateSecret()
  data.userIdentities.push({ userId: 1, provider: 'totp', providerUserId: secret })
  const { body } = await preview(token)
  assert.equal(body.passwordResetVerification, 'totp')
  const grant = (credentials: Row) => request(endpoint, { userId: 1,
    body: { token, confirmation: body.confirmation, allowPasswordReset: true, ...credentials } })
  assert.equal((await grant({ code: otplib.authenticator.generate(secret) })).status, 400)
  assert.equal((await grant({ password: currentPassword })).status, 400)
  data.users[0].permissions = ['priv:admin-console']
  assert.equal((await grant({ password: currentPassword, code: otplib.authenticator.generate(secret) })).status, 403)
  assert.equal(data.astrbotBindings.length, 0)
  data.users[0].permissions = null
  const result = await grant({ password: currentPassword, code: otplib.authenticator.generate(secret) })
  assert.equal(result.status, 200)
  assert.equal(result.body.passwordResetGranted, true)
})

test('获准的机器人两步重置密码，改密或解绑后旧确认失效', async (t) => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'astrbot-bind-test-secret'
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })
  const token = await issue()
  const { body } = await preview(token)
  const grant = await request(endpoint, { userId: 1,
    body: { token, confirmation: body.confirmation, allowPasswordReset: true, password: currentPassword } })
  assert.equal(grant.status, 200)
  const first = await resetPassword({ step: 'init' })
  assert.equal(first.status, 200)
  const confirmation = { step: 'confirm', pendingToken: first.body.pendingToken }
  assert.equal((await resetPassword(confirmation, 'wrong-token')).status, 401)
  assert.equal((await resetPassword({ ...confirmation, password: 'QaDifferent!2026' })).status, 400)
  data.users[0].permissions = ['priv:admin-console']
  assert.equal((await resetPassword(confirmation)).status, 403)
  data.users[0].permissions = null
  assert.equal((await resetPassword(confirmation)).status, 200)
  assert.equal(data.users[0].tokenVersion, 1)
  assert.equal(await bcrypt.compare(newPassword, data.users[0].password), true)
  assert.equal((await resetPassword(confirmation)).status, 400)
  await request('/api/notifications/astrbot/unbind', { userId: 1, body: { platform: 'qq' } })
  assert.equal((await resetPassword({ step: 'init' })).status, 403)
})

test('票据使用随机原文和带密钥的摘要，数据库没有票据原文字段', () => {
  const ticket = createAstrbotBindTicket()
  assert.match(ticket, /^[a-f0-9]{48}$/)
  assert.notEqual(hashAstrbotBindTicket(ticket, botToken), hashAstrbotBindTicket(ticket, 'rotated'))
  const config = getTableConfig(astrbotBindTickets)
  assert.ok(config.columns.some(col => col.name === 'tokenHash' && col.primary))
  assert.ok(!config.columns.some(col => col.name === 'token'))
  assert.ok(config.indexes.some(index => index.config.name === 'AstrbotBindTicket_expires_idx'))
})

test('机器人签发必须通过令牌鉴权并使用受信配置；过期记录惰性清理', async () => {
  const body = { umo, platform: 'aiocqhttp' }
  assert.equal((await request('/api/bot/voicehub/bind-link', { body, token: 'wrong' })).status, 401)
  publicHost = ''
  assert.equal((await request('/api/bot/voicehub/bind-link', { body, token: botToken })).status, 503)
  assert.equal(data.astrbotBindTickets.length, 0)
  publicHost = 'https://voicehub.example.test'
  const old = await issue()
  data.astrbotBindTickets[0].expiresAt = new Date(0)
  await issue()
  assert.equal(data.astrbotBindTickets.length, 1)
  assert.equal((await preview(old)).status, 400)
})

test('预览不创建绑定，只返回当前账号和目标；确认必须属于预览时的账号及登录会话', async () => {
  const token = await issue()
  assert.equal((await request(`${endpoint}?token=${token}`)).status, 401)
  const res = await preview(token)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(res.body.account, { username: 'alice', name: 'Alice' })
  assert.deepEqual(res.body.target, { adapter: 'aiocqhttp', instance: 'qq-instance', chatId: '123456' })
  assert.match(res.body.expiresAtDisplay, /^\d{4}\/\d+\/\d+ \d+:\d{2}:\d{2}$/)
  assert.match(res.body.confirmation, /^[a-f0-9]{64}$/)
  assert.equal(data.astrbotBindings.length, 0)
  assert.equal((await confirm(token, res.body.confirmation, 2)).status, 400)
  assert.equal((await confirm(token, res.body.confirmation, 1, 'other-session')).status, 400)
  assert.equal((await request(endpoint, { userId: 1, body: { token } })).status, 400)
  assert.equal((await confirm(token, res.body.confirmation)).status, 200)
  assert.equal((await confirm(token, res.body.confirmation)).status, 200)
  assert.equal(data.astrbotBindings.length, 1)
  assert.equal((await preview(token, 2)).status, 400)
})

test('确认前会话被撤销、密码版本变化、平台关闭或机器人令牌轮换都不写绑定', async () => {
  const token = await issue()
  const { body } = await preview(token)
  data.authSessions[0].revokedAt = new Date()
  assert.equal((await confirm(token, body.confirmation)).status, 401)
  delete data.authSessions[0].revokedAt
  data.users[0].tokenVersion++
  assert.equal((await confirm(token, body.confirmation)).status, 401)
  data.users[0].tokenVersion--
  data.systemSettings[0].astrbotPlatforms.qq = false
  assert.equal((await confirm(token, body.confirmation)).status, 400)
  data.systemSettings[0].astrbotPlatforms.qq = true
  data.systemSettings[0].astrbotToken = 'rotated'
  assert.equal((await preview(token)).status, 400)
  assert.equal((await confirm(token, body.confirmation)).status, 400)
  assert.equal(data.astrbotBindings.length, 0)
})

test('确认重新检查现有绑定，跨账号冲突不泄露归属或消耗票据', async () => {
  const token = await issue()
  const { body } = await preview(token)
  const existing = { userId: 1, platform: 'qq', adapter: 'aiocqhttp', umo: `${umo}7`, boundAt: new Date() }
  data.astrbotBindings.push(existing)
  assert.equal((await preview(token)).body.conflict, 'account')
  assert.equal((await confirm(token, body.confirmation)).status, 409)
  assert.deepEqual(data.astrbotBindings, [existing])
  data.astrbotBindings[0] = { ...existing, userId: 2, umo }
  const conflict = (await preview(token)).body
  assert.equal(conflict.conflict, 'chat')
  assert.equal(conflict.current, null)
  assert.equal(conflict.confirmation, null)
  assert.ok(!JSON.stringify(conflict).includes('bob'))
  assert.equal((await confirm(token, body.confirmation)).status, 409)
  assert.equal(data.astrbotBindTickets[0].consumedAt, undefined)
})

test('绑定写入后如果票据已过期，事务回滚绑定', async () => {
  const token = await issue()
  const { body } = await preview(token)
  expireOnBind = true
  assert.equal((await confirm(token, body.confirmation)).status, 400)
  assert.equal(data.astrbotBindings.length, 0)
})

test('网页和机器人解绑都作废绑定目标的待用票据与已确认票据', async () => {
  for (const path of ['/api/notifications/astrbot/unbind', '/api/bot/voicehub/unbind']) {
    const old = await issue()
    const token = await issue()
    const { body } = await preview(token)
    assert.equal((await confirm(token, body.confirmation)).status, 200)
    const res = await request(path, { userId: 1, token: botToken, body: { platform: 'qq', umo } })
    assert.equal(res.status, 200)
    assert.equal((await preview(old)).status, 400)
    assert.equal((await confirm(token, body.confirmation)).status, 400)
    assert.equal(data.astrbotBindings.length, 0)
  }
})
