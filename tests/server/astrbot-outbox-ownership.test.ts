import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

// 将服务依赖替换为最小桩，直接运行真实领取与入队逻辑，而非检查源码字符串。
const source = new URL('../../server/services/astrbotOutboxService.ts', import.meta.url).pathname
const modules: Record<string, string> = {
  'drizzle-orm': `export const and=(...args)=>args, asc=x=>x, eq=(a,b)=>[a,b], inArray=(a,b)=>[a,b], isNull=x=>x, lt=(a,b)=>[a,b], or=(...args)=>args, sql=(strings,...values)=>strings;`,
  '~/drizzle/schema': `export const astrbotOutbox={id:'id',attempts:'attempts',deliveredAt:'deliveredAt',failedAt:'failedAt',leasedUntil:'leasedUntil'}; export const astrbotBindings={umo:'umo',userId:'userId',boundAt:'boundAt',adapter:'adapter',platform:'platform'}; export const notificationSettings={userId:'userId',enabled:'enabled'};`,
  '~/drizzle/db': `export const db=globalThis.__outboxDb;`,
  '~~/server/utils/serverTime': `export const getServerDate=()=>new Date('2026-09-25T00:00:00Z');`,
  '~~/server/utils/astrbot-platforms': `export const selectAstrbotTargets=(rows,settings)=>rows.filter(x=>x.enabled!==false && settings?.[x.platform]===true).map(x=>x.umo);`,
  '~~/server/utils/astrbot-group': `export const normalizeAstrbotGroupTargets=(raw)=>Array.isArray(raw)?raw:[]; export const isAstrbotGroupTargetAllowed=(targets,platforms,umo)=>Array.isArray(targets)&&targets.some(t=>t.umo===umo && platforms?.[t.platform]===true);`,
  '~~/server/utils/system-settings-helper': `export const getSystemSettingsCached=async()=>({astrbotEnabled:true,astrbotPlatforms:{qq:true}});`,
  '~~/server/utils/astrbot-payload': `export const fitsAstrbotPayload=()=>true;`,
  '~~/server/utils/astrbot-pull': `export const isAstrbotOutboxExhausted=x=>x>=3;`
}
Object.assign(globalThis, { __outboxDb: { select() {}, transaction() {} } })
const compiled = await build({ entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'outbox-fixture', setup(b) {
    b.onResolve({ filter: /^(drizzle-orm|~\/drizzle\/|~~\/server\/utils\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
  } }] })
const service = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
const umo = 'bot:FriendMessage:shared'

function fixture(owner: number, existing?: { targets?: unknown; umos: string[]; broadcast: boolean }) {
  const state = { bindings: [{ userId: owner, umo, platform: 'qq', adapter: 'aiocqhttp', enabled: true,
    boundAt: new Date('2026-09-24T12:00:00Z') }],
    rows: existing ? [{ id: 1, attempts: 0, ...existing }] : [] as any[] }
  const transaction = {
    select(fields?: object) { return {
      from(table: object) { const isQueue = 'id' in table; const rows = isQueue ? state.rows : state.bindings
        const chain: any = { where() { return chain }, orderBy() { return chain }, limit() { return chain }, for() { return chain },
          leftJoin() { return chain }, then(resolve: (v: unknown) => void) { resolve(isQueue && fields ? rows.map(row => ({ id: row.id })) : rows) } }
        return chain
      }
    } },
    update() { return { set(values: object) { return { where() { return { returning: async () => state.rows.map(row => ({ ...row, ...values })) } } } } } },
    insert() { return { values: async (rows: any[]) => { state.rows.push(...rows.map((row, i) => ({ id: i + 1, attempts: 0, ...row }))) } } },
    transaction(fn: (tx: unknown) => Promise<unknown>) { return fn(transaction) }
  }
  Object.assign((globalThis as any).__outboxDb, transaction)
  return state
}

test('A 入队后解绑、B 绑定相同 UMO 不向 B 泄露', async () => {
  const state = fixture(1)
  assert.equal(await service.enqueueAstrbotNotifications([1], '私信', '只给 A'), 1)
  state.bindings[0].userId = 2
  assert.deepEqual(await service.claimAstrbotOutbox(), [])
})

test('迁移前缺少绑定快照的队列即使当前 UMO 有主人也不交付', async () => {
  fixture(2, { umos: [umo], broadcast: false })
  assert.deepEqual(await service.claimAstrbotOutbox(), [])
})

test('绑定主体未变化时正常领取', async () => {
  fixture(1)
  await service.enqueueAstrbotNotifications([1], '私信', '只给 A')
  const rows = await service.claimAstrbotOutbox()
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].umos, [umo])
})

test('同一账号解绑后重新绑定也拒绝旧队列', async () => {
  const state = fixture(1)
  await service.enqueueAstrbotNotifications([1], '私信', '旧通知')
  state.bindings[0].boundAt = new Date('2026-09-25T12:00:00Z')
  assert.deepEqual(await service.claimAstrbotOutbox(), [])
})

test('绑定版本缺失时即便主体相同也不交付', async () => {
  const state = fixture(1)
  state.bindings[0].boundAt = null as any
  await service.enqueueAstrbotNotifications([1], '私信', '旧通知')
  assert.deepEqual(await service.claimAstrbotOutbox(), [])
})
