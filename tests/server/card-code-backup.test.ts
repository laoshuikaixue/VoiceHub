import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const modules: Record<string, string> = {
  'drizzle-orm': `export const eq=(field,value)=>row=>row[field.split('.').at(-1)]===value;
    export const and=(...conditions)=>row=>conditions.every(condition=>condition(row));`,
  '~/drizzle/schema': `const table=(name,fields)=>Object.fromEntries([['_table',name],...fields.map(field=>[field,name+'.'+field])]);
    export const cardCodes=table('cards',['id']);
    export const users=table('users',['id','name','username']);
    export const cardCodeAssignments=table('assignments',['id','cardCodeId','userId']);`,
  '~~/server/utils/serverTime': `export const getServerDate=()=>new Date('2026-10-26T12:00:00Z');`
}
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../../server/utils/card-code-backup.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'backup-fixture', setup(builder) {
    builder.onResolve({ filter: /^(drizzle-orm|~\/drizzle\/schema|~~\/server\/utils\/serverTime)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
  } }]
})
const service = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
const assignedAt = new Date('2026-10-25T03:00:00Z')

function fixture() {
  const state: Record<string, any[]> = {
    cards: [{ id: 20, code: 'TEST', assignedTo: 30, status: 'ASSIGNED', assignedAt }],
    users: [{ id: 30, name: '接收人', username: 'recipient' }, { id: 31, name: '管理员' }],
    assignments: []
  }
  const checkUnique = () => {
    const active = state.assignments.filter(row => row.status === 'ASSIGNED' && row.cardCodeId != null)
    assert.equal(new Set(active.map(row => row.cardCodeId)).size, active.length)
  }
  const tx = {
    select(fields?: Record<string, string>) {
      let table: any
      let predicate = (_row: any) => true
      let limit = Infinity
      const chain: any = {
        from(value: any) { table = value; return chain },
        where(value: any) { predicate = value; return chain },
        limit(value: number) { limit = value; return chain },
        for() { return chain },
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
      checkUnique()
    } } } } },
    insert(table: any) { return { async values(values: any) {
      const row = { id: Math.max(0, ...state[table._table].map(row => row.id)) + 1, ...values }
      state[table._table].push(row)
      checkUnique()
    } } }
  }
  const mappings = { users: new Map([[3, 30], [4, 31]]), cardCodes: new Map([[2, 20]]) }
  return { state, tx, mappings }
}

test('合并恢复持有券时立即建立活跃记录，随后导入原流水补齐元数据', async () => {
  const { state, tx, mappings } = fixture()
  await service.syncRestoredCardCodeAssignment(tx, state.cards[0])
  assert.equal(state.assignments.length, 1)
  assert.equal(state.assignments[0].userId, 30)
  assert.equal(state.assignments[0].status, 'ASSIGNED')
  const source = { id: 999, cardCodeId: 2, codeSnapshot: 'TEST', userId: 3,
    assignedBy: 4, assignedAt: new Date(assignedAt.getTime() + 5).toISOString(), status: 'ASSIGNED', notifyStatus: 'SENT', note: '原备注' }
  assert.equal(await service.restoreCardCodeAssignmentRecord(tx, source, 'merge', mappings), 'updated')
  assert.equal(state.assignments.length, 1)
  assert.notEqual(state.assignments[0].id, 999)
  assert.equal(state.assignments[0].assignedBy, 31)
  assert.equal(state.assignments[0].note, '原备注')
  await service.restoreCardCodeAssignmentRecord(tx, source, 'merge', mappings)
  assert.equal(state.assignments.length, 1)
})

test('已投稿券恢复为活跃派发记录，已核销券恢复为 USED', async () => {
  for (const [status, expected] of [['LOCKED', 'ASSIGNED'], ['REDEEMED', 'USED']]) {
    const { state, tx } = fixture()
    state.cards[0].status = status
    await service.syncRestoredCardCodeAssignment(tx, state.cards[0])
    assert.equal(state.assignments[0].status, expected)
    assert.equal(state.cards[0].status, status)
  }
})

test('合并恢复换持有人时收敛旧记录，历史流水不会复活旧持有权', async () => {
  const { state, tx, mappings } = fixture()
  state.assignments.push({ id: 1, cardCodeId: 20, userId: 31, status: 'ASSIGNED', assignedAt: new Date('2026-10-20T00:00:00Z') })
  await service.syncRestoredCardCodeAssignment(tx, state.cards[0])
  assert.equal(state.assignments[0].status, 'RECYCLED')
  await service.restoreCardCodeAssignmentRecord(tx, {
    id: 8, cardCodeId: 2, codeSnapshot: 'TEST', userId: 4, assignedAt: '2026-10-20T00:00:00Z', status: 'ASSIGNED'
  }, 'merge', mappings)
  assert.equal(state.assignments.filter(row => row.status === 'ASSIGNED').length, 1)
  assert.equal(state.assignments[0].status, 'RECYCLED')
})

test('合并恢复不通过跨库原始 ID 绑定无映射用户与券', async () => {
  const { state, tx, mappings } = fixture()
  await service.restoreCardCodeAssignmentRecord(tx, {
    id: 9, cardCodeId: 20, codeSnapshot: 'OTHER', userId: 30,
    assignedAt: assignedAt.toISOString(), status: 'ASSIGNED'
  }, 'merge', mappings)
  assert.equal(state.assignments[0].cardCodeId, null)
  assert.equal(state.assignments[0].userId, null)
  assert.equal(state.assignments[0].status, 'RECYCLED')
})

test('替换恢复保留流水 ID 并映射相关账户', async () => {
  const { state, tx, mappings } = fixture()
  await service.restoreCardCodeAssignmentRecord(tx, {
    id: 99, cardCodeId: 2, codeSnapshot: 'TEST', userId: 3, assignedBy: 4,
    assignedAt: assignedAt.toISOString(), status: 'ASSIGNED'
  }, 'replace', mappings)
  assert.equal(state.assignments[0].id, 99)
  assert.equal(state.assignments[0].cardCodeId, 20)
  assert.equal(state.assignments[0].userId, 30)
  assert.equal(state.assignments[0].assignedBy, 31)
})
