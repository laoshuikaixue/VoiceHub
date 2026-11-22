import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createApp, createRouter, eventHandler, toWebHandler } from 'h3'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { astrbotBindTickets } from '../../app/drizzle/schema.ts'
import {
  createAstrbotBindTicket, hashAstrbotBindTicket
} from '../../server/utils/astrbot-notification.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const tables = ['astrbotBindTickets', 'astrbotBindingCodes', 'astrbotBindings', 'systemSettings', 'users', 'authSessions'] as const
const compiled = await build({
  stdin: {
    resolveDir: root,
    contents: `
      export { default as issue } from './server/api/bot/voicehub/bind-link.post.ts';
      export { default as read } from './server/api/notifications/astrbot/bind-ticket.get.ts';
      export { default as confirm } from './server/api/notifications/astrbot/bind-ticket.post.ts';
      export { default as unbind } from './server/api/notifications/astrbot/unbind.post.ts';
      export { default as botUnbind } from './server/api/bot/voicehub/unbind.post.ts';
    `
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '~': `${root}/app`, '~~': root },
  plugins: [{
    name: 'bind-ticket-fixture',
    setup(plugin) {
      plugin.onResolve({ filter: /^(h3|dayjs(?:\/.*)?)$/ }, ({ path }) => ({ path: import.meta.resolve(path), external: true }))
      plugin.onResolve({ filter: /^(~\/drizzle\/(db|schema)|drizzle-orm)$/ }, ({ path }) => ({ path, namespace: 'fixture' }))
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: {
        '~/drizzle/db': `export const db = globalThis.astrbotBindTestDb`,
        '~/drizzle/schema': tables.map(table => `export const ${table} = new Proxy({ table: '${table}' }, {
          get: (object, key) => key === 'table' ? object.table : key
        });`).join('\n'),
        'drizzle-orm': `export const eq = (col, value) => row => row[col] === value;
          export const gt = (col, value) => row => row[col] > value;
          export const lte = (col, value) => row => row[col] <= value;
          export const isNull = col => row => row[col] == null;
          export const and = (...predicates) => row => predicates.every(predicate => predicate(row));`
      }[path] }))
    }
  }]
})

type Row = Record<string, any>
type Records = Record<typeof tables[number], Row[]>
const botToken = 'qa-bot-token'
const umo = 'qq-instance:FriendMessage:123456'
const endpoint = '/api/notifications/astrbot/bind-ticket'
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
          if (op === 'update') rows.forEach(row => Object.assign(row, update))
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
  if (account) event.context.user = { ...account, sessionId: event.node.req.headers['x-qa-session'] || account.sessionId }
}))
app.use(createRouter()
  .post('/api/bot/voicehub/bind-link', handlers.issue)
  .get(endpoint, handlers.read)
  .post(endpoint, handlers.confirm)
  .post('/api/notifications/astrbot/unbind', handlers.unbind)
  .post('/api/bot/voicehub/unbind', handlers.botUnbind))
const handle = toWebHandler(app)

test.beforeEach(() => {
  expireOnBind = false
  publicHost = 'https://voicehub.example.test'
  data = {
    astrbotBindTickets: [], astrbotBindings: [], astrbotBindingCodes: [],
    systemSettings: [{ astrbotEnabled: true, astrbotToken: botToken, astrbotPlatforms: { qq: true } }],
    users: accounts.map(account => ({ ...account, forcePasswordChange: false })),
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
