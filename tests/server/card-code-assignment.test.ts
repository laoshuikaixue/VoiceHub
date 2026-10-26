import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const modules: Record<string, string> = {
  'drizzle-orm': `export const eq=(left,right)=>({kind:'eq',left,right});
    export const and=(...conditions)=>({kind:'and',conditions});
    export const inArray=(left,values)=>({kind:'in',left,values});
    export const isNull=left=>({kind:'null',left});
    export const notExists=query=>({kind:'notExists',query});
    export const desc=field=>({field,direction:-1});
    export const sql=(strings,...values)=>({strings,values});`,
  '~/drizzle/schema': `const table=(name,fields)=>Object.fromEntries([['_table',name],...fields.map(key=>[key,{table:name,key}])]);
    export const cardCodes=table('cards',['id','code','status','assignedTo','assignedAt','updatedAt']);
    export const cardCodeAssignments=table('assignments',['id','cardCodeId','codeSnapshot','userId','status','assignedAt']);
    export const users=table('users',['id']); export const songs=table('songs',['id','cardCodeId']);`,
  '~/drizzle/db': `export const db=new Proxy({}, {get:(_,key)=>(...args)=>globalThis.__cardAssignmentDb[key](...args)});`,
  '~~/server/utils/serverTime': `export const getServerDate=()=>new Date('2026-10-26T12:00:00Z');`,
  '~~/server/utils/apiError': `export const createApiError=(statusCode,code,message)=>Object.assign(new Error(message),{statusCode,data:{code}});`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES=new Proxy({}, {get:(_,name)=>name});`,
  '~~/server/services/notificationService': `export const createSystemNotification=(...args)=>globalThis.__cardAssignmentNotify(...args);`
}

async function loadService(name: string) {
  const compiled = await build({
    entryPoints: [fileURLToPath(new URL(`../../server/services/${name}.ts`, import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'card-assignment-fixture', setup(builder) {
      builder.onResolve({ filter: /^~~\/server\/services\/cardCodeGeneratorService$/ }, () => ({
        path: fileURLToPath(new URL('../../server/services/cardCodeGeneratorService.ts', import.meta.url))
      }))
      builder.onResolve({ filter: /^(drizzle-orm|~\/drizzle\/|~~\/server\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    } }]
  })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
}
const assignment = await loadService('cardCodeAssignmentService')
const generator = await loadService('cardCodeGeneratorService')
const actor = { id: 99, name: '管理员' }
const assignedAt = new Date('2026-10-25T00:00:00Z')

function fixture() {
  const state: Record<string, any[]> = {
    cards: [], assignments: [], songs: [], users: [30, 40, 50, 99].map(id => ({ id })), notifications: []
  }
  const controls: {
    failTarget?: number
    failAuditUpdate?: boolean
    insertCollision?: boolean
    conflictIgnored?: boolean
  } = {}
  const value = (operand: any, context: any) => operand?.table ? context[operand.table]?.[operand.key] : operand
  const matches = (condition: any, context: any): boolean => {
    if (!condition) return true
    switch (condition.kind) {
      case 'eq': return value(condition.left, context) === value(condition.right, context)
      case 'and': return condition.conditions.every((entry: any) => matches(entry, context))
      case 'in': return condition.values.includes(value(condition.left, context))
      case 'null': return value(condition.left, context) == null
      case 'notExists': return condition.query.run(context).length === 0
      default: throw new Error(`未支持的查询条件: ${condition.kind}`)
    }
  }
  const project = (row: any, fields?: any) => fields
    ? Object.fromEntries(Object.entries(fields).map(([key, field]: [string, any]) => [key, row[field.key]]))
    : { ...row }
  const db: any = {
    select(fields?: any) {
      let table: any
      let predicate: any
      let limit = Infinity
      let ordering: any[] = []
      const query: any = {
        from(next: any) { table = next; return query }, where(next: any) { predicate = next; return query },
        limit(next: number) { limit = next; return query }, for() { return query },
        orderBy(...next: any[]) { ordering = next; return query },
        run(context: any = {}) {
          const rows = state[table._table].filter(row => matches(predicate, { ...context, [table._table]: row }))
          rows.sort((left, right) => {
            for (const entry of ordering) {
              const a = left[entry.field.key]
              const b = right[entry.field.key]
              if (a < b) return -entry.direction
              if (a > b) return entry.direction
            }
            return 0
          })
          return rows.slice(0, limit).map(row => project(row, fields))
        },
        then(resolve: any, reject: any) { return Promise.resolve().then(() => query.run()).then(resolve, reject) }
      }
      return query
    },
    update(table: any) { return { set(values: any) { return { where(predicate: any) {
      const run = (fields?: any) => {
        if (table._table === 'cards' && values.assignedTo === controls.failTarget && controls.failTarget) {
          throw new Error('模拟接收人外键失效')
        }
        if (table._table === 'assignments' && controls.failAuditUpdate && values.status === 'RECYCLED') return []
        return state[table._table].filter(row => matches(predicate, { [table._table]: row })).map(row => {
          Object.assign(row, values)
          return project(row, fields)
        })
      }
      return { returning: async (fields?: any) => run(fields), then(resolve: any, reject: any) {
        return Promise.resolve().then(() => run()).then(resolve, reject)
      } }
    } } } } },
    insert(table: any) { return { values(input: any) {
      const rows = Array.isArray(input) ? input : [input]
      let ignoreConflict = false
      const query: any = {
        onConflictDoNothing() { ignoreConflict = true; controls.conflictIgnored = true; return query },
        run(fields?: any) {
          if (table._table === 'cards' && controls.insertCollision) {
            state.cards.push({ id: 500, code: rows[0].code, status: 'AVAILABLE' })
            controls.insertCollision = false
          }
          const created = []
          for (const values of rows) {
            if (table._table === 'cards' && state.cards.some(row => row.code === values.code)) {
              if (ignoreConflict) continue
              throw new Error('重复券码')
            }
            const row = { id: Math.max(0, ...state[table._table].map(row => row.id)) + 1, assignedAt,
              assignedTo: null, ...values }
            state[table._table].push(row)
            created.push(project(row, fields))
          }
          return created
        },
        returning: async (fields?: any) => query.run(fields),
        then(resolve: any, reject: any) { return Promise.resolve().then(() => query.run()).then(resolve, reject) }
      }
      return query
    } } },
    delete(table: any) { return { async where(predicate: any) {
      state[table._table] = state[table._table].filter(row => !matches(predicate, { [table._table]: row }))
    } } },
    async transaction(callback: any) {
      const before = structuredClone(state)
      try { return await callback(db) } catch (error) {
        for (const key of Object.keys(state)) state[key] = before[key]
        throw error
      }
    }
  }
  Object.assign(globalThis, {
    __cardAssignmentDb: db,
    __cardAssignmentNotify: async (userId: number, title: string, message: string) => {
      state.notifications.push({ userId, title, message })
      return true
    }
  })
  const addHeld = (id: number, holder = 30) => {
    state.cards.push({ id, code: `CARD-${id}`, status: 'ASSIGNED', assignedTo: holder, assignedAt })
    state.assignments.push({ id, cardCodeId: id, codeSnapshot: `CARD-${id}`, userId: holder, status: 'ASSIGNED', assignedAt })
  }
  return { state, controls, db, addHeld }
}

test('归还仅恢复当前持有人最近一次 USED，不复活旧持有人和旧周期', async () => {
  const { state, db } = fixture()
  state.cards.push({ id: 1, assignedTo: 30, assignedAt })
  state.assignments.push(
    { id: 1, cardCodeId: 1, userId: 40, status: 'USED', assignedAt },
    { id: 2, cardCodeId: 1, userId: 30, status: 'USED', assignedAt: new Date('2026-10-24T00:00:00Z') },
    { id: 3, cardCodeId: 1, userId: 30, status: 'USED', assignedAt: new Date(assignedAt.getTime() + 1) }
  )
  await assignment.restoreCardCodeAssignment(db, 1)
  assert.deepEqual(state.assignments.map(row => row.status), ['USED', 'USED', 'ASSIGNED'])
  await assignment.restoreCardCodeAssignment(db, 1)
  assert.deepEqual(state.assignments.map(row => row.status), ['USED', 'USED', 'ASSIGNED'])
})

test('当前周期缺少 USED 时不会恢复同一用户历史 USED', async () => {
  const { state, db } = fixture()
  state.cards.push({ id: 1, assignedTo: 30, assignedAt })
  state.assignments.push({ id: 1, cardCodeId: 1, userId: 30, status: 'USED', assignedAt: new Date('2026-10-24T00:00:00Z') })
  await assignment.restoreCardCodeAssignment(db, 1)
  assert.equal(state.assignments[0].status, 'USED')
})

test('回收后从派发记录取得接收人并按持有人聚合通知', async () => {
  const { state, addHeld } = fixture()
  addHeld(1)
  addHeld(2)
  const results = await assignment.recycleCardCodeAssignments({ assignmentIds: [1, 2], actor })
  assert.equal(results.every((row: any) => row.success), true)
  assert.equal(state.cards.every(row => row.status === 'AVAILABLE' && row.assignedTo === null), true)
  assert.equal(state.assignments.every(row => row.status === 'RECYCLED'), true)
  assert.equal(state.notifications.length, 1)
  assert.equal(state.notifications[0].userId, 30)
  assert.match(state.notifications[0].message, /2 张/)
})

test('派发记录持有人与券不符时拒绝回收，不改状态或发送通知', async () => {
  const { state, addHeld } = fixture()
  addHeld(1)
  state.cards[0].assignedTo = 40
  const [result] = await assignment.recycleCardCodeAssignments({ assignmentIds: [1], actor })
  assert.equal(result.success, false)
  assert.equal(state.cards[0].assignedTo, 40)
  assert.equal(state.assignments[0].status, 'ASSIGNED')
  assert.equal(state.notifications.length, 0)
})

test('派发记录条件更新未命中时整张回收事务回滚', async () => {
  const { state, controls, addHeld } = fixture()
  addHeld(1)
  controls.failAuditUpdate = true
  const [result] = await assignment.recycleCardCodeAssignments({ assignmentIds: [1], actor })
  assert.equal(result.success, false)
  assert.equal(state.cards[0].status, 'ASSIGNED')
  assert.equal(state.cards[0].assignedTo, 30)
  assert.equal(state.notifications.length, 0)
})

test('生成派发单人异常仍处理后续用户、清理残券并通知成功用户', async (context) => {
  context.mock.method(console, 'error', () => {})
  const { state, controls } = fixture()
  controls.failTarget = 40
  const result = await assignment.generateAndAssignCardCodes({
    targets: [30, 40, 50].map(id => ({ id, name: `用户${id}` })), countPerUser: 2, actor
  })
  assert.equal(result.summary.assignedCount, 4)
  assert.equal(result.summary.failedCount, 2)
  assert.equal(state.cards.length, 4)
  assert.equal(state.cards.every(row => row.status === 'ASSIGNED'), true)
  assert.deepEqual(state.notifications.map(row => row.userId), [30, 50])
  assert.equal(state.notifications.every(row => /2 张/.test(row.message)), true)
  assert.equal(result.generatedCodes.length, 4)
})

test('生成残券清理保留已派发、锁定、关联投稿及活跃流水的券', async () => {
  const { state } = fixture()
  state.cards.push(
    { id: 1, status: 'AVAILABLE', assignedTo: null },
    { id: 2, status: 'ASSIGNED', assignedTo: 30 },
    { id: 3, status: 'LOCKED', assignedTo: null },
    { id: 4, status: 'AVAILABLE', assignedTo: null },
    { id: 5, status: 'AVAILABLE', assignedTo: null }
  )
  state.songs.push({ id: 1, cardCodeId: 4 })
  state.assignments.push({ id: 1, cardCodeId: 5, status: 'ASSIGNED' })
  await generator.deleteCardCodes([1, 2, 3, 4, 5])
  assert.deepEqual(state.cards.map(row => row.id), [2, 3, 4, 5])
})

test('生成入库时出现并发券码冲突仍返回本次成功插入的券', async () => {
  const { state, controls } = fixture()
  controls.insertCollision = true
  const result = await generator.createCardCodes({ codes: ['COLLISION', 'NEW'] })
  assert.equal(controls.conflictIgnored, true)
  assert.deepEqual(result.map((row: any) => row.code), ['NEW'])
  assert.equal(state.cards.length, 2)
})
