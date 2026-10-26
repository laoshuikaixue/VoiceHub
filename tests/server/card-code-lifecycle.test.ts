import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const columns = (table, names) => Object.fromEntries(names.map((name) => [name, `${table}.${name}`]))
const songs = columns('songs', ['id', 'cardCodeId', 'played', 'requesterId'])
const cardCodes = columns('cards', ['id', 'status'])
const schedules = columns('schedules', ['songId', 'isDraft', 'played'])
const cardCodeRedeemLogs = columns('logs', ['id', 'cardCodeId', 'songId', 'source'])
const tables = new Map([[songs, 'songs'], [cardCodes, 'cards'], [schedules, 'schedules'], [cardCodeRedeemLogs, 'logs']])
const columnName = (column) => column.slice(column.indexOf('.') + 1)
const eq = (column, value) => (row) => row[columnName(column)] === value
const inArray = (column, values) => (row) => values.includes(row[columnName(column)])
const and = (...conditions) => (row) => conditions.every((condition) => condition(row))
const desc = (column) => ({ column, direction: -1 })
const codes = {
  CARD_CODE_LOCKED_OR_UNAVAILABLE: 'CARD_CODE_LOCKED_OR_UNAVAILABLE',
  SONG_SCHEDULED_CANNOT_WITHDRAW: 'SONG_SCHEDULED_CANNOT_WITHDRAW',
  SONG_PLAYED_CANNOT_WITHDRAW: 'SONG_PLAYED_CANNOT_WITHDRAW'
}
const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, data: { code } })
const instant = new Date('2026-10-26T08:00:00Z')
const source = readFileSync(new URL('../../server/services/cardCodeLifecycleService.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?$/gm, '').replace(/^export /gm, '')
const lifecycle = new Function(
  'and', 'desc', 'eq', 'inArray', 'cardCodeRedeemLogs', 'cardCodes', 'schedules', 'songs',
  'getServerDate', 'createApiError', 'SERVER_ERROR_CODES', 'markCardCodeAssignmentUsed', 'restoreCardCodeAssignment',
  `${stripTypeScriptTypes(source)}\nreturn { redeemCardCodeForSchedule, restoreCardCodeAfterScheduleRemoval, releaseCardCodeAfterSongWithdrawal }`
)(and, desc, eq, inArray, cardCodeRedeemLogs, cardCodes, schedules, songs, () => instant, createApiError, codes,
  async (tx, cardCodeId) => { tx.assignmentEvents.push({ action: 'USED', cardCodeId }) },
  async (tx, cardCodeId) => { tx.assignmentEvents.push({ action: 'RESTORE', cardCodeId }) })

function fixture(overrides = {}) {
  const state = {
    songs: [{ id: 1, requesterId: 7, cardCodeId: 10, played: false }],
    cards: [{ id: 10, code: 'TEST', status: 'LOCKED', assignedTo: 7, lockedBy: 7, lockedAt: instant }],
    schedules: [], logs: [], ...overrides
  }
  const locks = []
  const assignmentEvents = []
  const project = (row, fields) => fields
    ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[columnName(column)]]))
    : { ...row }
  const tx = {
    assignmentEvents,
    select(fields) {
      let table, predicate = () => true, maximum = Infinity, order
      const query = {
        from(value) { table = value; return query },
        where(value) { predicate = value; return query },
        limit(value) { maximum = value; return query },
        orderBy(value) { order = value; return query },
        for(mode) { locks.push({ table: tables.get(table), mode }); return query },
        then(resolve, reject) {
          const rows = state[tables.get(table)].filter(predicate)
          if (order) rows.sort((a, b) => (a[columnName(order.column)] - b[columnName(order.column)]) * order.direction)
          return Promise.resolve(rows.slice(0, maximum).map((row) => project(row, fields))).then(resolve, reject)
        }
      }
      return query
    },
    update(table) {
      let changes, predicate = () => true, completed = false, updated
      const execute = () => {
        if (!completed) {
          completed = true
          updated = state[tables.get(table)].filter(predicate)
          updated.forEach((row) => Object.assign(row, changes))
        }
        return updated
      }
      const query = {
        set(value) { changes = value; return query },
        where(value) { predicate = value; return query },
        returning(fields) { return Promise.resolve(execute().map((row) => project(row, fields))) },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) }
      }
      return query
    },
    insert(table) {
      return { values(value) { state[tables.get(table)].push({ id: state[tables.get(table)].length + 1, ...value }); return Promise.resolve() } }
    }
  }
  const context = { songId: 1, cardCodeId: 10, operatorId: 99, at: instant }
  return { state, tx, locks, assignmentEvents, context }
}
const redeem = lifecycle.redeemCardCodeForSchedule
const restore = lifecycle.restoreCardCodeAfterScheduleRemoval
const withdraw = lifecycle.releaseCardCodeAfterSongWithdrawal
const conflict = (error) => error.statusCode === 409 && error.data.code === codes.CARD_CODE_LOCKED_OR_UNAVAILABLE

test('投稿、草稿和正式发布未播放均保留锁券', async () => {
  for (const schedules of [[], [{ songId: 1, isDraft: true, played: false }], [{ songId: 1, isDraft: false, played: false }]]) {
    const f = fixture({ schedules })
    const result = await redeem(f.tx, f.context)
    assert.equal(result.changed, false)
    assert.equal(f.state.cards[0].status, 'LOCKED')
    assert.equal(f.state.songs[0].cardCodeId, 10)
    assert.equal(f.state.logs.length, 0)
    assert.deepEqual(f.assignmentEvents, [])
    assert.deepEqual(f.locks.slice(0, 2), [{ table: 'songs', mode: 'update' }, { table: 'cards', mode: 'update' }])
  }
})

test('正式排期且已播放才核销，重复调用不重复日志和派发核销', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }] })
  f.state.songs[0].played = true
  assert.equal((await redeem(f.tx, f.context)).changed, true)
  assert.equal((await redeem(f.tx, f.context)).changed, false)
  assert.equal(f.state.cards[0].status, 'REDEEMED')
  assert.equal(f.state.cards[0].redeemedBy, 99)
  assert.equal(f.state.songs[0].cardCodeId, 10)
  assert.deepEqual(f.state.logs.map((log) => ({ source: log.source, songId: log.songId })), [{ source: 'SONG_PLAYED', songId: 1 }])
  assert.deepEqual(f.assignmentEvents, [{ action: 'USED', cardCodeId: 10 }])
})

test('仅草稿已播放仍不核销，正式排期独立播放记录可以核销', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: true, played: true }] })
  await redeem(f.tx, f.context)
  assert.equal(f.state.cards[0].status, 'LOCKED')
  f.state.schedules[0].isDraft = false
  await redeem(f.tx, f.context)
  assert.equal(f.state.cards[0].status, 'REDEEMED')
})

test('未播放发布取消和移除换日保留绑定且不产生核销', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }] })
  await redeem(f.tx, f.context)
  f.state.schedules.length = 0
  assert.equal((await restore(f.tx, f.context)).changed, false)
  f.state.schedules.push({ songId: 1, isDraft: false, played: false })
  await redeem(f.tx, f.context)
  assert.equal(f.state.cards[0].status, 'LOCKED')
  assert.equal(f.state.songs[0].cardCodeId, 10)
  assert.equal(f.state.logs.length, 0)
})

test('取消最后播放标记恢复LOCKED及派发持有记录', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }] })
  f.state.songs[0].played = true
  await redeem(f.tx, f.context)
  f.state.songs[0].played = false
  const result = await restore(f.tx, { ...f.context, cancelPlayback: true })
  assert.equal(result.status, 'LOCKED')
  assert.equal(f.state.cards[0].lockedBy, 7)
  assert.equal(f.state.cards[0].redeemedAt, null)
  assert.equal(f.state.songs[0].cardCodeId, 10)
  assert.deepEqual(f.state.logs.map((log) => log.source), ['SONG_PLAYED', 'PLAYBACK_CANCEL'])
  assert.deepEqual(f.assignmentEvents, [{ action: 'USED', cardCodeId: 10 }, { action: 'RESTORE', cardCodeId: 10 }])
})

test('仍有正式播放记录时撤销全局播放标记不退券', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: true }] })
  await redeem(f.tx, f.context)
  const result = await restore(f.tx, { ...f.context, cancelPlayback: true })
  assert.equal(result.reason, 'ALREADY_PLAYED')
  assert.equal(f.state.cards[0].status, 'REDEEMED')
})

test('已播放歌曲取消排期和换日不退券、不重复核销', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }] })
  f.state.songs[0].played = true
  await redeem(f.tx, f.context)
  f.state.schedules.length = 0
  assert.equal((await restore(f.tx, f.context)).reason, 'ALREADY_PLAYED')
  f.state.schedules.push({ songId: 1, isDraft: false, played: false })
  await redeem(f.tx, f.context)
  assert.equal(f.state.cards[0].status, 'REDEEMED')
  assert.equal(f.state.logs.length, 1)
  assert.equal(f.assignmentEvents.length, 1)
})

test('撤回未播放歌曲解绑并归还指定券或公共券', async () => {
  for (const assignedTo of [7, null]) {
    const f = fixture()
    f.state.cards[0].assignedTo = assignedTo
    const result = await withdraw(f.tx, f.context)
    assert.equal(result.status, assignedTo === null ? 'AVAILABLE' : 'ASSIGNED')
    assert.equal(f.state.songs[0].cardCodeId, null)
    assert.equal(f.state.cards[0].lockedBy, null)
    assert.equal(f.state.logs[0].source, 'WITHDRAW')
    assert.equal(f.assignmentEvents.length, assignedTo === null ? 0 : 1)
  }
})

test('已发布或已播放歌曲不能通过用户撤回归还', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }] })
  await assert.rejects(withdraw(f.tx, f.context), (error) => error.data.code === codes.SONG_SCHEDULED_CANNOT_WITHDRAW)
  f.state.songs[0].played = true
  await redeem(f.tx, f.context)
  await assert.rejects(withdraw(f.tx, f.context), (error) => error.data.code === codes.SONG_PLAYED_CANNOT_WITHDRAW)
  assert.equal(f.state.songs[0].cardCodeId, 10)
  assert.equal(f.state.cards[0].status, 'REDEEMED')
})

test('旧投稿不能释放新投稿的券，多投稿绑定同券时拒绝变更', async () => {
  for (const duplicate of [false, true]) {
    const f = fixture()
    if (!duplicate) f.state.songs[0].cardCodeId = null
    f.state.songs.push({ id: 2, requesterId: 7, cardCodeId: 10, played: false })
    for (const transition of [redeem, restore, withdraw]) await assert.rejects(transition(f.tx, f.context), conflict)
    assert.equal(f.state.cards[0].status, 'LOCKED')
    assert.equal(f.state.songs[1].cardCodeId, 10)
    assert.equal(f.state.logs.length, 0)
  }
})

test('手工或其他投稿的核销日志不能冒充当前投稿核销', async () => {
  for (const log of [
    { cardCodeId: 10, songId: 1, source: 'ADMIN_MANUAL' },
    { cardCodeId: 10, songId: 2, source: 'SONG_PLAYED' },
    { cardCodeId: 11, songId: 1, source: 'SONG_PLAYED' }
  ]) {
    const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }], logs: [{ id: 1, ...log }] })
    f.state.songs[0].played = true
    f.state.cards[0].status = 'REDEEMED'
    await assert.rejects(redeem(f.tx, f.context), conflict)
    assert.equal(f.state.logs.length, 1)
    assert.equal(f.assignmentEvents.length, 0)
  }
})

test('手工核销不能通过撤销播放或撤回转换成可用券', async () => {
  for (const transition of [restore, withdraw]) {
    const f = fixture({ logs: [{ id: 1, cardCodeId: 10, songId: 1, source: 'ADMIN_MANUAL' }] })
    f.state.cards[0].status = 'REDEEMED'
    await assert.rejects(transition(f.tx, { ...f.context, cancelPlayback: true }), conflict)
    assert.equal(f.state.cards[0].status, 'REDEEMED')
    assert.equal(f.state.songs[0].cardCodeId, 10)
    assert.equal(f.state.logs.length, 1)
  }
})

test('独立排期播放记录被删除后，播放核销日志仍阻止退券', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: true }] })
  await redeem(f.tx, f.context)
  f.state.schedules.length = 0
  assert.equal((await restore(f.tx, f.context)).reason, 'ALREADY_PLAYED')
  await assert.rejects(withdraw(f.tx, f.context), (error) => error.data.code === codes.SONG_PLAYED_CANNOT_WITHDRAW)
  assert.equal((await withdraw(f.tx, { ...f.context, removeSong: true })).reason, 'ALREADY_PLAYED')
  assert.equal(f.state.cards[0].status, 'REDEEMED')
  assert.equal(f.state.songs[0].cardCodeId, 10)
  assert.equal(f.state.logs.length, 1)
})

test('明确撤销最后独立排期播放记录后才回退锁券', async () => {
  const f = fixture({ schedules: [
    { songId: 1, isDraft: false, played: true },
    { songId: 1, isDraft: false, played: true }
  ] })
  await redeem(f.tx, f.context)
  f.state.schedules[0].played = false
  assert.equal((await restore(f.tx, { ...f.context, cancelPlayback: true })).reason, 'ALREADY_PLAYED')
  f.state.schedules[1].played = false
  assert.equal((await restore(f.tx, { ...f.context, cancelPlayback: true })).status, 'LOCKED')
  assert.equal(f.state.songs[0].cardCodeId, 10)
  assert.deepEqual(f.state.logs.map((log) => log.source), ['SONG_PLAYED', 'PLAYBACK_CANCEL'])
})

test('删除已正式播出但尚未核销的歌曲先核销并保留消费记录', async () => {
  for (const independent of [false, true]) {
    const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: independent }] })
    f.state.songs[0].played = !independent
    const result = await withdraw(f.tx, { ...f.context, removeSong: true })
    assert.equal(result.status, 'REDEEMED')
    assert.equal(f.state.cards[0].status, 'REDEEMED')
    assert.equal(f.state.songs[0].cardCodeId, 10)
    assert.deepEqual(f.state.logs.map((log) => log.source), ['SONG_PLAYED'])
    f.state.schedules.length = 0
    await withdraw(f.tx, { ...f.context, removeSong: true })
    assert.equal(f.state.logs.length, 1)
  }
})

test('删除未播放的正式投稿允许解绑归还', async () => {
  const f = fixture({ schedules: [{ songId: 1, isDraft: false, played: false }] })
  assert.equal((await withdraw(f.tx, { ...f.context, removeSong: true })).status, 'ASSIGNED')
  assert.equal(f.state.songs[0].cardCodeId, null)
  assert.equal(f.state.logs[0].source, 'WITHDRAW')
})

test('已标播放但无正式排期的锁券投稿删除时归还', async () => {
  const f = fixture()
  f.state.songs[0].played = true
  await assert.rejects(withdraw(f.tx, f.context), (error) => error.data.code === codes.SONG_PLAYED_CANNOT_WITHDRAW)
  assert.equal((await withdraw(f.tx, { ...f.context, removeSong: true })).status, 'ASSIGNED')
  assert.equal(f.state.songs[0].cardCodeId, null)
  assert.equal(f.state.cards[0].redeemedAt, null)
  assert.deepEqual(f.state.logs.map((log) => log.source), ['WITHDRAW'])
  assert.ok(!f.assignmentEvents.some((event) => event.action === 'USED'))
})
