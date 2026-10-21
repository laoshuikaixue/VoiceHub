import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, type H3Event } from 'h3'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

type FixtureRow = Record<string, unknown>
type FixtureSelection = Record<string, unknown>
type QueryCall = { sql: string; params: string[] }
type AdminQuery = { selection: FixtureSelection; table?: FixtureRow; condition?: SQL }

interface FixtureQueryChain extends PromiseLike<FixtureRow[]> {
  from(table: FixtureRow): FixtureQueryChain
  innerJoin(): FixtureQueryChain
  leftJoin(): FixtureQueryChain
  where(condition: SQL | undefined): FixtureQueryChain
  orderBy(): FixtureQueryChain
  groupBy(): FixtureQueryChain
}

interface FixtureDatabase {
  unsafe(sql: string, params?: string[]): Promise<FixtureRow[]>
  select(selection?: FixtureSelection): FixtureQueryChain
}

interface ScheduleResponseItem {
  playDate: string
  song: {
    playUrl: string | null
    requester?: string
    requesterGrade: string | null
    requesterId?: number
    isAnonymous?: boolean
    submissionNote: string | null
  }
}

interface AdminResponse {
  success: boolean
  data: {
    schedules: ScheduleResponseItem[]
    summary: { totalSchedules: number; includeDrafts: string }
    groupedByDate: Array<{ date: string }>
  }
}

type RouteHandler<T> = { default: (event: H3Event) => Promise<T> }
type DateQueryModule = {
  parseScheduleDateQuery(value: unknown): { startOfDay: Date; endOfDay: Date } | null
}

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const database: FixtureDatabase = {
  unsafe: async () => [],
  select: () => { throw new Error('未配置管理查询测试桩') }
}
Object.assign(globalThis, {
  __schedulePlaylistDb: database,
  getSyncedTimestamp: () => Date.parse('2026-10-20T04:00:00.000Z')
})

// 执行真实路由、日期校验、SQL 构造及脱敏逻辑，只替换数据库和认证依赖。
async function loadModule<T>(path: string): Promise<T> {
  const fixtureModules: Record<string, string> = {
    database: 'export const db = globalThis.__schedulePlaylistDb; export const client = db;',
    auth: 'export const verifyUserAuth = async event => ({ success: !!event.context.user, user: event.context.user });',
    settings: 'export const getSystemSettingsCached = async () => null;'
  }
  const result = await build({
    entryPoints: [resolve(root, path)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    tsconfigRaw: { compilerOptions: {} },
    define: { 'import.meta.server': 'false' },
    write: false,
    banner: { js: 'var { defineEventHandler, getQuery, createError } = require("h3");' },
    plugins: [{
      name: 'schedule-query-fixture',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, (args) => {
          if (args.path === '~/drizzle/db') return { path: 'database', namespace: 'fixture' }
          if (args.path === '../../utils/auth') return { path: 'auth', namespace: 'fixture' }
          if (args.path === './system-settings-helper') return { path: 'settings', namespace: 'fixture' }
          if (args.path.startsWith('~~/')) return { path: resolve(root, args.path.slice(3) + '.ts') }
          if (args.path.startsWith('~/')) return { path: resolve(root, 'app', args.path.slice(2) + '.ts') }
          return null
        })
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
          contents: fixtureModules[args.path],
          loader: 'js'
        }))
      }
    }]
  })
  const module: { exports: unknown } = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports as T
}

const publicHandler = (await loadModule<RouteHandler<ScheduleResponseItem[]>>('server/api/songs/public.get.ts')).default
const adminHandler = (await loadModule<RouteHandler<AdminResponse>>('server/api/admin/schedule/full.get.ts')).default
const { parseScheduleDateQuery } = await loadModule<DateQueryModule>('server/utils/schedule-date-query.ts')
const dialect = new PgDialect()

function eventFor(query: Record<string, string | string[]> = {}, role?: string) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item))
  }
  const request = new IncomingMessage(new Socket())
  request.url = `/api/test?${params}`
  request.method = 'GET'
  const event = createEvent(request, new ServerResponse(request))
  if (role) event.context.user = { id: 7, role }
  return event
}

function publicRow(playDate: string, extra: FixtureRow = {}) {
  return {
    id: 1, playDate, sequence: 1, songId: 10, title: '测试歌曲', artist: '测试歌手',
    requesterId: 8, requesterName: '张三', requesterGrade: '高一', requesterClass: '一班',
    requesterNameCount: 1, requesterGradeCount: 1,
    hideStudentInfo: true, submissionAnonymous: false, isDraft: false, semester: '测试学期',
    playUrl: 'https://example.com/custom.mp3', ...extra
  }
}

function publicFixture({ rows = [publicRow('2026-10-20')], fallback = false, settings = {}, draftColumn = true } = {}) {
  const calls: QueryCall[] = []
  database.unsafe = async (sql, params = []) => {
    calls.push({ sql, params: [...params] })
    if (sql.includes('information_schema.columns')) return draftColumn ? [{ exists: 1 }] : []
    if (sql.includes('SELECT "scheduleDaysBeforeEnabled"')) return [settings]
    if (fallback && sql.includes('vote_counts AS')) throw Object.assign(new Error('兼容分支'), { code: '42703' })
    const bounds = [...sql.matchAll(/sch\."playDate"\s*(>=|<)\s*\$(\d+)/g)]
    return structuredClone(rows.filter((row) => {
      if (sql.includes('sch."isDraft" = false') && row.isDraft) return false
      if (sql.includes('s.semester = $1') && row.semester !== params[0]) return false
      return bounds.every(([, operator, index]) => {
        const timestamp = `${row.playDate}T00:00:00.000Z`
        return operator === '>=' ? timestamp >= params[Number(index) - 1] : timestamp < params[Number(index) - 1]
      })
    }))
  }
  return calls
}

function scheduleCall(calls: QueryCall[]) {
  return calls.filter(({ sql }) => sql.includes('FROM "Schedule" sch')).at(-1)!
}

function isInvalidParams(error: unknown) {
  assert.ok(error instanceof Error)
  assert.ok('statusCode' in error)
  assert.equal(error.statusCode, 400)
  assert.ok('data' in error && typeof error.data === 'object' && error.data !== null && 'code' in error.data)
  assert.equal(error.data.code, 'COMMON_INVALID_PARAMS')
  return true
}

test('日期校验接受闰日，按 UTC 生成跨月、跨年的半开区间', () => {
  for (const [date, next] of [['2024-02-29', '2024-03-01'], ['2000-02-29', '2000-03-01'], ['2026-12-31', '2027-01-01']]) {
    const range = parseScheduleDateQuery(date)
    assert.ok(range)
    assert.equal(range.startOfDay.toISOString(), `${date}T00:00:00.000Z`)
    assert.equal(range.endOfDay.toISOString(), `${next}T00:00:00.000Z`)
  }
  assert.equal(parseScheduleDateQuery(undefined), null)
})

test('两个接口拒绝不存在的日期、非规范格式、重复参数和注入内容，且不查询数据库', async () => {
  const invalid = ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01',
    '2026-01-00', '0000-01-01', '2026-1-01', '2026/10/20', '2026-10-20T00:00:00Z',
    ' 2026-10-20', '', "2026-10-20' OR 1=1 --", ['2026-10-20', '2026-10-21']]
  const calls = publicFixture()
  for (const date of invalid) {
    await assert.rejects(() => publicHandler(eventFor({ date })), isInvalidParams)
    await assert.rejects(() => adminHandler(eventFor({ date }, 'SONG_ADMIN')), isInvalidParams)
  }
  assert.deepEqual(calls, [])
})

test('公共主查询按日期过滤，日期仅通过参数传递，并保留已发布过滤及歌曲播放链接', async () => {
  const calls = publicFixture({ rows: [publicRow('2026-10-19'), publicRow('2026-10-20'),
    publicRow('2026-10-21'), publicRow('2026-10-20', { isDraft: true })] })
  const result = await publicHandler(eventFor({ date: '2026-10-20' }))
  assert.equal(result.length, 1)
  assert.equal(result[0].playDate, '2026-10-20')
  assert.equal(result[0].song.playUrl, 'https://example.com/custom.mp3')
  const query = scheduleCall(calls)
  assert.deepEqual(query.params, ['2026-10-20T00:00:00.000Z', '2026-10-21T00:00:00.000Z'])
  assert.match(query.sql, /sch\."playDate" >= \$1 AND sch\."playDate" < \$2/)
  assert.ok(!query.sql.includes('2026-10-20'))
})

test('日期、学期与普通用户可见范围取交集，参数序号连续', async () => {
  const calls = publicFixture({ settings: { scheduleDaysBeforeEnabled: true, scheduleDaysBefore: 1,
    scheduleDaysAfterEnabled: true, scheduleDaysAfter: 1 } })
  const result = await publicHandler(eventFor({ semester: '测试学期', date: '2026-10-18' }))
  assert.deepEqual(result, [])
  const query = scheduleCall(calls)
  assert.deepEqual(query.params, ['测试学期', '2026-10-18T00:00:00.000Z', '2026-10-19T00:00:00.000Z',
    '2026-10-19T00:00:00.000Z', '2026-10-22T00:00:00.000Z'])
  assert.deepEqual([...query.sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])), [1, 2, 3, 4, 5])
})

test('管理员仍不受公开日期可见范围限制，但请求日期仍过滤且草稿仍排除', async () => {
  const calls = publicFixture({ rows: [publicRow('2026-10-01'), publicRow('2026-10-01', { isDraft: true })],
    settings: { scheduleDaysBeforeEnabled: true, scheduleDaysBefore: 1 } })
  const result = await publicHandler(eventFor({ date: '2026-10-01' }, 'ADMIN'))
  assert.equal(result.length, 1)
  assert.equal(scheduleCall(calls).params.length, 2)
  assert.equal(result[0].song.requester, '张三')
})

test('公共接口带日期时保留学生脱敏、匿名投稿和私密留言权限', async () => {
  publicFixture({ rows: [publicRow('2026-10-20', { effectiveSubmissionNote: '私密留言',
    effectiveSubmissionNotePublic: false, submissionAnonymous: true })] })
  const guest = (await publicHandler(eventFor({ date: '2026-10-20' })))[0].song
  assert.equal(guest.isAnonymous, true)
  assert.equal(guest.requesterGrade, null)
  assert.equal(guest.requesterId, undefined)
  assert.equal(guest.submissionNote, null)
  const admin = (await publicHandler(eventFor({ date: '2026-10-20' }, 'ADMIN')))[0].song
  assert.equal(admin.requester, '张三')
  assert.equal(admin.submissionNote, '私密留言')
})

test('公共接口不传日期时保持原查询范围和响应形状', async () => {
  const calls = publicFixture({ rows: [publicRow('2026-10-19'), publicRow('2026-10-20')] })
  const result = await publicHandler(eventFor())
  assert.ok(Array.isArray(result))
  assert.equal(result.length, 2)
  assert.deepEqual(scheduleCall(calls).params, [])
  assert.doesNotMatch(scheduleCall(calls).sql, /sch\."playDate"\s*(>=|<)/)
})

test('兼容分支同时应用日期和学期参数，并保留原草稿过滤和脱敏', async (t) => {
  t.mock.method(console, 'error', () => {})
  const calls = publicFixture({ fallback: true, rows: [publicRow('2026-10-19'), publicRow('2026-10-20'),
    publicRow('2026-10-21'), publicRow('2026-10-20', { isDraft: true })] })
  const result = await publicHandler(eventFor({ date: '2026-10-20', semester: '测试学期' }))
  assert.equal(result.length, 1)
  assert.equal(result[0].song.requester, '***')
  assert.equal(result[0].song.requesterId, undefined)
  const query = scheduleCall(calls)
  assert.deepEqual(query.params, ['测试学期', '2026-10-20T00:00:00.000Z', '2026-10-21T00:00:00.000Z'])
  assert.match(query.sql, /sch\."playDate" >= \$2 AND sch\."playDate" < \$3/)
  assert.ok(!query.sql.includes('2026-10-20'))
})

test('兼容分支没有草稿字段时仍按日期过滤，无日期时保留原范围', async (t) => {
  t.mock.method(console, 'error', () => {})
  const calls = publicFixture({ fallback: true, draftColumn: false,
    rows: [publicRow('2026-10-19'), publicRow('2026-10-20'), publicRow('2026-10-21')] })
  assert.equal((await publicHandler(eventFor({ date: '2026-10-20' }))).length, 1)
  assert.deepEqual(scheduleCall(calls).params, ['2026-10-20T00:00:00.000Z', '2026-10-21T00:00:00.000Z'])
  assert.equal((await publicHandler(eventFor())).length, 3)
  assert.deepEqual(scheduleCall(calls).params, [])
})

function adminFixture(playUrl: string | null = 'https://example.com/admin-custom.mp3') {
  const queries: AdminQuery[] = []
  database.select = (selection = {}) => {
    const state: AdminQuery = { selection }
    const chain: FixtureQueryChain = {
      from(table) { state.table = table; return chain },
      innerJoin() { return chain }, leftJoin() { return chain },
      where(condition) { state.condition = condition; return chain },
      orderBy() { return chain }, groupBy() { return chain },
      then(onfulfilled, onrejected) {
        let rows: FixtureRow[] = []
        if (state.table && 'playDate' in state.table) {
          queries.push(state)
          const playUrlColumn = selection.songPlayUrl
          assert.ok(typeof playUrlColumn === 'object' && playUrlColumn !== null && 'name' in playUrlColumn)
          assert.equal(playUrlColumn.name, 'playUrl')
          rows = [{ id: 1, playDate: new Date('2026-10-20T00:00:00.000Z'), songId: 10,
            songTitle: '测试歌曲', songArtist: '测试歌手', songPlayUrl: playUrl }]
        } else if (state.table && 'password' in state.table) rows = []
        else if (selection.count) rows = [{ count: 0 }]
        return Promise.resolve(rows).then(onfulfilled, onrejected)
      }
    }
    return chain
  }
  return queries
}

test('管理接口按 UTC 日期边界查询，并保留时段及草稿过滤和原响应形状', async () => {
  const queries = adminFixture()
  const result = await adminHandler(eventFor({ date: '2026-10-20', playTimeId: '2', includeDrafts: 'false' }, 'SONG_ADMIN'))
  assert.ok(queries[0].condition)
  const query = dialect.sqlToQuery(queries[0].condition)
  assert.deepEqual(query.params, ['2026-10-20T00:00:00.000Z', '2026-10-21T00:00:00.000Z', 2, false])
  assert.match(query.sql, /"playDate" >= \$1/)
  assert.match(query.sql, /"playDate" < \$2/)
  assert.equal(result.success, true)
  assert.equal(result.data.schedules[0].song.playUrl, 'https://example.com/admin-custom.mp3')
  assert.equal(result.data.summary.totalSchedules, 1)
  assert.equal(result.data.groupedByDate[0].date, '2026-10-20')
})

test('管理接口不传日期时保留默认包含草稿，空播放链接返回 null', async () => {
  const queries = adminFixture(null)
  const result = await adminHandler(eventFor({}, 'ADMIN'))
  assert.equal(queries[0].condition, undefined)
  assert.equal(result.data.summary.includeDrafts, 'true')
  assert.equal(result.data.schedules[0].song.playUrl, null)
})

test('管理接口仍拒绝匿名和普通用户', async () => {
  await assert.rejects(() => adminHandler(eventFor()), (error: unknown) =>
    error instanceof Error && 'statusCode' in error && error.statusCode === 401)
  await assert.rejects(() => adminHandler(eventFor({}, 'USER')), (error: unknown) =>
    error instanceof Error && 'statusCode' in error && error.statusCode === 403)
})

test('UTC、上海和洛杉矶服务器时区下两个接口生成相同日期边界', async () => {
  const original = process.env.TZ
  try {
    for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
      process.env.TZ = timezone
      const calls = publicFixture()
      await publicHandler(eventFor({ date: '2026-03-08' }))
      assert.deepEqual(scheduleCall(calls).params, ['2026-03-08T00:00:00.000Z', '2026-03-09T00:00:00.000Z'])
      const queries = adminFixture()
      await adminHandler(eventFor({ date: '2026-03-08' }, 'ADMIN'))
      assert.ok(queries[0].condition)
      assert.deepEqual(dialect.sqlToQuery(queries[0].condition).params,
        ['2026-03-08T00:00:00.000Z', '2026-03-09T00:00:00.000Z'])
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})
