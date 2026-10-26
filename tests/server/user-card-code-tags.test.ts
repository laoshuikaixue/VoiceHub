import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const modules: Record<string, string> = {
  'h3': `export const defineEventHandler=fn=>fn; export const getRouterParam=event=>event.id;`,
  'drizzle-orm': `export const eq=(field,value)=>row=>row[field.split('.').at(-1)]===value;
    export const inArray=(field,values)=>row=>values.includes(row[field.split('.').at(-1)]);
    export const and=(...conditions)=>row=>conditions.every(condition=>condition(row)); export const asc=field=>field;`,
  '~/drizzle/db': `export const db={transaction:fn=>globalThis.__userDataDb.transaction(fn)};`,
  '~/drizzle/schema': `const table=(name,fields)=>Object.fromEntries([['_table',name],...fields.map(field=>[field,name+'.'+field])]);
    export const users=table('users',['id','tags','name']);
    export const cardCodes=table('cards',['id','status','assignedTo']);
    export const cardCodeAssignments=table('assignments',['id','cardCodeId','status']);`,
  '~~/server/utils/serverTime': `export const getServerDate=()=>new Date('2026-10-26T12:00:00Z');`,
  '~~/server/utils/apiError': `export const createApiError=(statusCode,code,message)=>Object.assign(new Error(message),{statusCode,data:{code}});`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES=new Proxy({}, {get:(_,name)=>name});`
}

async function loadRoute(relative: string) {
  const compiled = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'user-data-fixture', setup(builder) {
      builder.onResolve({ filter: /^(h3|drizzle-orm|~\/drizzle\/|~~\/server\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    } }]
  })
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)).default
}
Object.assign(globalThis, { defineEventHandler: (fn: unknown) => fn, readBody: async (event: any) => event.body })
const deleteUser = await loadRoute('../../server/api/admin/users/[id].delete.ts')
const changeTags = await loadRoute('../../server/api/admin/users/tags.post.ts')

function fixture() {
  const state: Record<string, any[]> = {
    users: [{ id: 2, role: 'USER', tags: [] }],
    cards: ['ASSIGNED', 'LOCKED', 'REDEEMED'].map((status, index) => ({ id: index + 1, status, assignedTo: 2, assignedAt: new Date() })),
    assignments: ['ASSIGNED', 'ASSIGNED', 'USED'].map((status, index) => ({ id: index + 1, cardCodeId: index + 1, status }))
  }
  const locks: string[] = []
  const tx = {
    select(fields?: Record<string, string>) {
      let table: any
      let predicate = (_row: any) => true
      let limit = Infinity
      const chain: any = {
        from(value: any) { table = value; return chain }, where(value: any) { predicate = value; return chain },
        orderBy() { return chain }, limit(value: number) { limit = value; return chain },
        for() { locks.push(table._table); return chain },
        then(resolve: any, reject: any) {
          return Promise.resolve(state[table._table].filter(predicate).slice(0, limit).map(row => fields
            ? Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, row[field.split('.').at(-1)!]]))
            : { ...row })).then(resolve, reject)
        }
      }
      return chain
    },
    update(table: any) { return { set(values: any) { return { async where(predicate: any) {
      for (const row of state[table._table].filter(predicate)) Object.assign(row, values)
    } } } } },
    delete(table: any) { return { async where(predicate: any) {
      if (table._table === 'users') {
        assert.equal(state.cards.some(row => row.status === 'ASSIGNED' && row.assignedTo === 2), false)
      }
      state[table._table] = state[table._table].filter(row => !predicate(row))
    } } }
  }
  let tail = Promise.resolve()
  ;(globalThis as any).__userDataDb = { transaction(callback: any) {
    const next = tail.then(() => callback(tx))
    tail = next.catch(() => {})
    return next
  } }
  return { state, locks }
}

test('删除持有人只回收未投稿券，保留投稿和核销状态并收敛活跃流水', async () => {
  const { state, locks } = fixture()
  const result = await deleteUser({ id: '2', context: { user: { id: 9, role: 'SUPER_ADMIN', name: '管理员' } } })
  assert.equal(result.success, true)
  assert.deepEqual(state.cards.map(row => row.status), ['AVAILABLE', 'LOCKED', 'REDEEMED'])
  assert.equal(state.cards.every(row => row.assignedTo === null && row.assignedAt === null), true)
  assert.deepEqual(state.assignments.map(row => row.status), ['RECYCLED', 'RECYCLED', 'USED'])
  assert.deepEqual(locks, ['users', 'cards'])
  assert.equal(state.users.length, 0)
})

test('并发添加标签基于事务内最新标签集合，不覆盖先提交的标签', async () => {
  const { state, locks } = fixture()
  const event = (tag: string) => ({ context: { user: { id: 9, role: 'SONG_ADMIN' } }, body: { userIds: [2], add: [tag] } })
  await Promise.all([changeTags(event('广播员')), changeTags(event('住校生'))])
  assert.deepEqual(state.users[0].tags, ['广播员', '住校生'])
  assert.deepEqual(locks, ['users', 'users'])
})

test('标签数量上限在持锁后的最新集合上校验', async () => {
  const { state } = fixture()
  state.users[0].tags = Array.from({ length: 9 }, (_, index) => `标签${index}`)
  const event = (tag: string) => ({ context: { user: { id: 9, role: 'SONG_ADMIN' } }, body: { userIds: [2], add: [tag] } })
  const results = await Promise.all([changeTags(event('广播员')), changeTags(event('住校生'))])
  assert.equal(state.users[0].tags.length, 10)
  assert.equal(results.reduce((sum, result) => sum + result.updatedCount, 0), 1)
  assert.equal(results[1].skipped.length, 1)
})
