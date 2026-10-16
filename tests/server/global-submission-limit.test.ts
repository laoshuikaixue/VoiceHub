import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 运行真实的 server/utils/submissionLimit.ts，覆盖全站投稿总量限额：
 * 三个周期可叠加、留空不限制、0 表示停止投稿、计数不区分用户且短路求值。
 */

const source = fileURLToPath(new URL('../../server/utils/submissionLimit.ts', import.meta.url))

const modules: Record<string, string> = {
  '~/drizzle/db': `export const db = globalThis.__limitDb;
    export const songs = { createdAt: 'createdAt', requesterId: 'requesterId', cardCodeId: 'cardCodeId' };`,
  'drizzle-orm': `export const and = (...args) => ['and', ...args.filter(Boolean)];
    export const count = () => 'count';
    export const eq = (column, value) => ['eq', column, value];
    export const gte = (column, value) => ['gte', column, value];
    export const isNull = (column) => ['isNull', column];
    export const lte = (column, value) => ['lte', column, value];`,
  '~/utils/timeUtils': `export const getBeijingStartOfDay = () => new Date('2026-10-14T00:00:00Z');
    export const getBeijingEndOfDay = () => new Date('2026-10-14T15:59:59Z');
    export const getBeijingStartOfWeek = () => new Date('2026-10-12T00:00:00Z');
    export const getBeijingEndOfWeek = () => new Date('2026-10-18T15:59:59Z');
    export const getBeijingStartOfMonth = () => new Date('2026-10-01T00:00:00Z');
    export const getBeijingEndOfMonth = () => new Date('2026-10-31T15:59:59Z');`
}

const compiled = await build({
  entryPoints: [source],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [
    {
      name: 'submission-limit-fixture',
      setup(b) {
        b.onResolve({ filter: /^(drizzle-orm|~\/drizzle\/|~\/utils\/)/ }, (args) => ({
          path: args.path,
          namespace: 'fixture'
        }))
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
          contents: modules[args.path],
          loader: 'js'
        }))
      }
    }
  ]
})

const limitModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)
const {
  findReachedGlobalSubmissionLimit,
  findExceededGlobalSubmissionLimit,
  getActiveGlobalSubmissionLimits,
  getGlobalSubmissionCount
} = limitModule

// 北京时间窗口起点 -> 预设的全站投稿数，同时记录全部查询条件
let queries: any[] = []

function fixture(countsByWindowStart: Record<string, number>) {
  queries = []
  Object.assign(globalThis as any, {
    __limitDb: {
      select() {
        return {
          from() {
            return {
              where(condition: unknown) {
                const [, gteExpr, lteExpr] = condition as any[]
                queries.push({ gte: gteExpr, lte: lteExpr })
                return Promise.resolve([{ count: countsByWindowStart[gteExpr[2].toISOString()] ?? 0 }])
              }
            }
          }
        }
      }
    }
  })
}

const DAILY_START = '2026-10-14T00:00:00.000Z'
const WEEKLY_START = '2026-10-12T00:00:00.000Z'
const MONTHLY_START = '2026-10-01T00:00:00.000Z'

test('开关关闭时残留数值也不生效', () => {
  assert.deepEqual(
    getActiveGlobalSubmissionLimits({
      enableGlobalSubmissionLimit: false,
      globalDailySubmissionLimit: 5,
      globalMonthlySubmissionLimit: 30
    }),
    []
  )
  assert.deepEqual(getActiveGlobalSubmissionLimits(null), [])
  assert.deepEqual(getActiveGlobalSubmissionLimits({}), [])
})

test('三个周期独立解析，留空跳过，0 视为停止投稿的限额', () => {
  assert.deepEqual(
    getActiveGlobalSubmissionLimits({
      enableGlobalSubmissionLimit: true,
      globalDailySubmissionLimit: 0,
      globalWeeklySubmissionLimit: null,
      globalMonthlySubmissionLimit: 30
    }),
    [
      { type: 'daily', limit: 0 },
      { type: 'monthly', limit: 30 }
    ]
  )
})

test('全站计数不按用户过滤，达到上限的周期被返回', async () => {
  fixture({ [DAILY_START]: 3, [WEEKLY_START]: 12, [MONTHLY_START]: 40 })

  const reached = await findReachedGlobalSubmissionLimit(
    (globalThis as any).__limitDb,
    {
      enableGlobalSubmissionLimit: true,
      globalDailySubmissionLimit: 5,
      globalWeeklySubmissionLimit: 10,
      globalMonthlySubmissionLimit: null
    }
  )

  assert.deepEqual(reached, { type: 'weekly', limit: 10 })
  // 周额度是第二次查询，月度未配置故不查询；条件里只有时间窗口，没有 requesterId
  assert.equal(queries.length, 2)
  assert.equal(JSON.stringify(queries[1]).includes('requesterId'), false)
  assert.equal(queries[0].gte[2].toISOString(), DAILY_START)
  assert.equal(queries[1].lte[2].toISOString(), '2026-10-18T15:59:59.000Z')
})

test('全部周期未达上限时返回 null', async () => {
  fixture({ [DAILY_START]: 1, [MONTHLY_START]: 5 })

  const reached = await findReachedGlobalSubmissionLimit(
    (globalThis as any).__limitDb,
    {
      enableGlobalSubmissionLimit: true,
      globalDailySubmissionLimit: 3,
      globalWeeklySubmissionLimit: null,
      globalMonthlySubmissionLimit: 20
    }
  )

  assert.equal(reached, null)
})

test('限额为 0 时无论有无投稿都拒绝', async () => {
  fixture({})

  const reached = await findReachedGlobalSubmissionLimit(
    (globalThis as any).__limitDb,
    {
      enableGlobalSubmissionLimit: true,
      globalDailySubmissionLimit: 0,
      globalWeeklySubmissionLimit: null,
      globalMonthlySubmissionLimit: null
    }
  )

  assert.deepEqual(reached, { type: 'daily', limit: 0 })
})

test('按周期取全站投稿总量', async () => {
  fixture({ [MONTHLY_START]: 7 })
  assert.equal(await getGlobalSubmissionCount((globalThis as any).__limitDb, 'monthly'), 7)
  assert.equal(queries[0].gte[2].toISOString(), MONTHLY_START)

  fixture({ [DAILY_START]: 2 })
  assert.equal(await getGlobalSubmissionCount((globalThis as any).__limitDb, 'daily'), 2)
})

test('批量预留：单首可过但整批会突破时返回被突破的限额', async () => {
  const settings = {
    enableGlobalSubmissionLimit: true,
    globalDailySubmissionLimit: 5,
    globalWeeklySubmissionLimit: 10,
    globalMonthlySubmissionLimit: null
  }

  // 逐首（addCount=1）：日 4+1<=5、周 8+1<=10，均可过
  fixture({ [DAILY_START]: 4, [WEEKLY_START]: 8, [MONTHLY_START]: 10 })
  assert.equal(
    await findExceededGlobalSubmissionLimit((globalThis as any).__limitDb, settings, 1),
    null
  )

  // 一次导入 2 首：日 4+2>5，先命中日限额
  assert.deepEqual(
    await findExceededGlobalSubmissionLimit((globalThis as any).__limitDb, settings, 2),
    { type: 'daily', limit: 5 }
  )

  // 一次导入 3 首：日 1+3<=5 未突破，周 8+3>10 命中周限额
  fixture({ [DAILY_START]: 1, [WEEKLY_START]: 8, [MONTHLY_START]: 10 })
  assert.deepEqual(
    await findExceededGlobalSubmissionLimit((globalThis as any).__limitDb, settings, 3),
    { type: 'weekly', limit: 10 }
  )
})
