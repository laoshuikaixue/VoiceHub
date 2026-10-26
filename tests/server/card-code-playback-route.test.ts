import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const target = globalThis as any
const modules: Record<string, string> = {
  '~/drizzle/db': `export const db=new Proxy({}, {get:(_,key)=>(...args)=>globalThis.__cardPlaybackFixture.db[key](...args)});`,
  '~/drizzle/schema': `const table=(name,fields)=>Object.fromEntries([['_table',name],...fields.map(key=>[key,{table:name,key}])]);
    export const songs=table('songs',['id','cardCodeId','played','playedAt','title','artist']);
    export const songReplayRequests=table('requests',['id','songId','status','updatedAt']);`,
  'drizzle-orm': `export const eq=(field,value)=>row=>row[field.key]===value;
    export const inArray=(field,values)=>row=>values.includes(row[field.key]);
    export const and=(...conditions)=>row=>conditions.every(condition=>condition(row));`,
  '~~/server/utils/serverTime': `export const getServerDate=()=>new Date('2026-10-26T08:00:00Z');`,
  '~~/server/utils/apiError': `export const createApiError=(statusCode,code,message)=>Object.assign(new Error(message),{statusCode,data:{code}});`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES=new Proxy({}, {get:(_,key)=>key});`,
  '~~/server/utils/ip-utils': `export const getClientIP=()=> '127.0.0.1';`,
  '~~/server/services/cardCodeLifecycleService': `export const redeemCardCodeForSchedule=(...args)=>globalThis.__cardPlaybackFixture.transition('REDEEM',...args);
    export const restoreCardCodeAfterScheduleRemoval=(...args)=>globalThis.__cardPlaybackFixture.transition('RESTORE',...args);`,
  '~~/server/utils/scheduleReplayBinding': `export const restoreReplayRequestsToPending=(args)=>globalThis.__cardPlaybackFixture.restoreReplay(args);`,
  '~~/server/services/notificationService': `export const createSongPlayedNotifications=(ids)=>globalThis.__cardPlaybackFixture.notify('USER',ids);`,
  '~~/server/services/astrbotGroupService': `export const enqueueAstrbotGroupEvent=(...args)=>globalThis.__cardPlaybackFixture.notify('GROUP',args);`
}

async function loadHandler(kind: string) {
  const compiled = await build({
    entryPoints: [fileURLToPath(new URL(`../../server/api/${kind}/songs/mark-played.post.ts`, import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    tsconfigRaw: { compilerOptions: {} },
    banner: { js: `const defineEventHandler=fn=>fn; const readBody=async event=>event.body;
      const createError=options=>Object.assign(new Error(options.message),options);` },
    plugins: [{ name: 'card-playback-route-fixture', setup(builder) {
      builder.onResolve({ filter: /^(drizzle-orm|~\/|~~\/)/ }, (args) => ({ path: args.path, namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => {
        if (!modules[args.path]) throw new Error(`未配置依赖: ${args.path}`)
        return { contents: modules[args.path], loader: 'js' }
      })
    } }]
  })
  const module = { exports: {} as any }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, module, module.exports)
  return module.exports.default
}
const handlers = { admin: await loadHandler('admin'), open: await loadHandler('open') }

function fixture({ played = false, failTransition = false } = {}) {
  const state = {
    songs: [{ id: 1, cardCodeId: 10, played, playedAt: played ? new Date(0) : null, title: '歌曲', artist: '歌手' }],
    requests: [{ id: 20, songId: 1, status: 'PENDING' }]
  }
  const calls: any[] = []
  const notifications: any[] = []
  const pending: Promise<unknown>[] = []
  let activeTx: any = null
  let committed = false
  let transactions = 0
  const project = (row: any, fields: any) => fields
    ? Object.fromEntries(Object.entries(fields).map(([key, field]: [string, any]) => [key, row[field.key]])) : { ...row }
  const tx = {
    update(table: any) { return { set(values: any) { return { where(predicate: any) { return {
      async returning(fields: any) {
        assert.equal(activeTx, tx)
        const rows = state[table._table].filter(predicate)
        rows.forEach((row: any) => Object.assign(row, values))
        calls.push({ action: 'UPDATE', table: table._table, values })
        return rows.map((row: any) => project(row, fields))
      }
    } } } } } }
  }
  const db = {
    async transaction(callback: any) {
      transactions++
      const before = structuredClone(state)
      activeTx = tx
      try {
        const result = await callback(tx)
        committed = true
        return result
      } catch (error) {
        Object.assign(state, before)
        throw error
      } finally { activeTx = null }
    },
    select(fields: any) { return { from(table: any) { return { where(predicate: any) {
      return Promise.resolve(state[table._table].filter(predicate).map((row: any) => project(row, fields)))
    } } } } }
  }
  const hooks = {
    db,
    async transition(action: string, connection: any, context: any) {
      assert.equal(connection, tx)
      assert.equal(activeTx, tx)
      assert.equal(state.songs[0].played, action === 'REDEEM')
      calls.push({ action, context })
      if (failTransition) throw Object.assign(new Error('模拟券并发冲突'), { statusCode: 409 })
      return { changed: true }
    },
    async restoreReplay({ tx: connection, songIds }: any) {
      assert.equal(connection, tx)
      assert.equal(activeTx, tx)
      calls.push({ action: 'RESTORE_REPLAY', songIds })
      return 0
    },
    async notify(action: string, data: unknown) {
      assert.equal(committed, true)
      assert.equal(activeTx, null)
      notifications.push({ action, data })
    }
  }
  target.__cardPlaybackFixture = hooks
  const event = (kind: string, body = {}, context = kind === 'admin'
    ? { user: { id: 99, role: 'SONG_ADMIN' } }
    : { apiKey: { id: 5, createdByUserId: 88 } }) => ({
      body: { songId: 1, ...body }, context,
      waitUntil(promise: Promise<unknown>) { pending.push(promise) }
    })
  return { state, calls, notifications, pending, event, get transactions() { return transactions } }
}

for (const kind of ['admin', 'open'] as const) {
  test(`${kind} 标记播放在同一事务内先更新歌曲再调用核销`, async () => {
    const f = fixture()
    const result = await handlers[kind](f.event(kind))
    await Promise.all(f.pending)
    assert.equal(result.count, 1)
    assert.deepEqual(result.updatedSongIds, [1])
    assert.equal(f.state.songs[0].played, true)
    assert.deepEqual(f.calls.slice(0, 2).map((call) => call.action), ['UPDATE', 'REDEEM'])
    assert.deepEqual(f.calls[1].context, {
      songId: 1, cardCodeId: 10, operatorId: kind === 'admin' ? 99 : 88,
      at: new Date('2026-10-26T08:00:00Z'), cancelPlayback: false
    })
    assert.ok(f.notifications.some((notification) => notification.action === 'USER'))
  })

  test(`${kind} 撤销播放清除歌曲标记并显式传cancelPlayback`, async () => {
    const f = fixture({ played: true })
    const result = await handlers[kind](f.event(kind, { unmark: true }))
    assert.equal(result.count, 1)
    assert.equal(f.state.songs[0].played, false)
    assert.equal(f.state.songs[0].playedAt, null)
    assert.deepEqual(f.calls.map((call) => call.action), ['UPDATE', 'RESTORE', 'RESTORE_REPLAY'])
    assert.equal(f.calls[1].context.cancelPlayback, true)
    assert.equal(f.calls[1].context.operatorId, kind === 'admin' ? 99 : 88)
    assert.equal(f.pending.length, 0)
    assert.equal(f.notifications.length, 0)
  })

  test(`${kind} 券状态转换失败回滚播放标记且不发成功通知`, async () => {
    const f = fixture({ failTransition: true })
    await assert.rejects(handlers[kind](f.event(kind)), (error: any) => error.statusCode === 409)
    assert.equal(f.state.songs[0].played, false)
    assert.equal(f.state.songs[0].playedAt, null)
    assert.equal(f.state.requests[0].status, 'PENDING')
    assert.equal(f.notifications.length, 0)
    assert.equal(f.pending.length, 0)
  })

  test(`${kind} 重复标记不再次调用核销或通知`, async () => {
    const f = fixture({ played: true })
    const result = await handlers[kind](f.event(kind))
    assert.equal(result.count, 0)
    assert.ok(!f.calls.some((call) => call.action === 'REDEEM'))
    assert.equal(f.notifications.length, 0)
    assert.equal(f.pending.length, 0)
  })
}

test('admin 无用户或角色不足时不启动播放事务', async () => {
  for (const [context, statusCode] of [[{}, 401], [{ user: { id: 3, role: 'USER' } }, 403]] as const) {
    const f = fixture()
    await assert.rejects(handlers.admin(f.event('admin', {}, context)), (error: any) => error.statusCode === statusCode)
    assert.equal(f.transactions, 0)
    assert.equal(f.calls.length, 0)
  }
})

test('open 缺少密钥创建人时拒绝写入播放和券审计', async () => {
  const f = fixture()
  await assert.rejects(handlers.open(f.event('open', {}, { apiKey: { id: 5 } })), (error: any) => [401, 403].includes(error.statusCode))
  assert.equal(f.transactions, 0)
  assert.equal(f.calls.length, 0)
  assert.equal(f.notifications.length, 0)
})
