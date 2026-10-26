import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const schema = {
  songs: { id: 'song.id', preferredPlayTimeId: 'song.preferredPlayTimeId' },
  songReplayRequests: { id: 'replay.id', songId: 'replay.songId', status: 'replay.status', createdAt: 'replay.createdAt' },
  schedules: { id: 'schedule.id' }
}
const codes = { SONG_REPLAY_INVALID_REQUEST: 'SONG_REPLAY_INVALID_REQUEST', SONG_SCHEDULE_PREFERRED_TIME_MISMATCH: 'SONG_SCHEDULE_PREFERRED_TIME_MISMATCH' }
const createApiError = (statusCode, code, message, data = {}) => Object.assign(new Error(message), {
  statusCode, data: { code, ...data }
})
const identity = (...args) => args
function loadUtility(path, exports) {
  const source = readFileSync(new URL(`../../server/utils/${path}`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?$/gm, '')
    .replace(/^export /gm, '')
  const compiled = stripTypeScriptTypes(source)
  const names = ['songs', 'songReplayRequests', 'schedules', 'createApiError', 'SERVER_ERROR_CODES', 'db', 'and', 'asc', 'eq', 'inArray', 'or', 'sql']
  return new Function(...names, `${compiled}\nreturn { ${exports.join(',')} }`)(
    schema.songs, schema.songReplayRequests, schema.schedules, createApiError, codes,
    { select() { throw new Error('校验必须使用事务连接') } }, identity, identity, identity, identity, identity, identity
  )
}
const binding = loadUtility('scheduleReplayBinding.ts', [
  'parseScheduleReplayRequestId', 'selectScheduleReplayBindings', 'resolveScheduleReplayBindings', 'fulfillReplayRequestsForSchedule'
])
const placement = loadUtility('schedulePlacementConstraint.ts', ['assertSchedulePlacement'])

test('最终重播绑定拒绝异歌、已拒绝和未绑定的已履行申请', () => {
  for (const row of [
    { id: 10, songId: 2, status: 'PENDING' },
    { id: 10, songId: 1, status: 'REJECTED' },
    { id: 10, songId: 1, status: 'FULFILLED' }
  ]) {
    assert.throws(() => binding.selectScheduleReplayBindings([{ songId: 1, replayRequestId: 10 }], [row]),
      (error) => error.data.code === codes.SONG_REPLAY_INVALID_REQUEST)
  }
  assert.throws(() => binding.parseScheduleReplayRequestId('invalid'))
})

test('重发保留当前有效绑定，缺省绑定选择最早待处理申请', () => {
  const rows = [{ id: 10, songId: 1, status: 'FULFILLED' }, { id: 11, songId: 1, status: 'PENDING' }]
  assert.equal(binding.selectScheduleReplayBindings([{ songId: 1 }], rows)[0].replayRequestId, 11)
  assert.equal(binding.selectScheduleReplayBindings([{ songId: 1, replayRequestId: 10 }], rows, new Map([[1, 10]]))[0].replayRequestId, 10)
  assert.equal(binding.selectScheduleReplayBindings([{ songId: 1 }], [], new Map())[0].replayRequestId, null)
})

test('事务解析先锁歌曲和申请，再返回唯一最终绑定', async () => {
  const locked = []
  const tx = {
    select() {
      let table
      const query = {
        from(value) { table = value; return query },
        where() { return query },
        orderBy() { return query },
        for(mode) { locked.push({ table, mode }); return query },
        then(resolve) {
          const rows = table === schema.songs ? [{ id: 1 }] : [{ id: 10, songId: 1, status: 'PENDING' }]
          return Promise.resolve(rows).then(resolve)
        }
      }
      return query
    }
  }
  const items = await binding.resolveScheduleReplayBindings(tx, [{ songId: 1 }])
  assert.equal(items[0].replayRequestId, 10)
  assert.deepEqual(locked, [{ table: schema.songs, mode: 'update' }, { table: schema.songReplayRequests, mode: 'update' }])
})

test('校验使用事务内最终绑定的重播时段并保留错误码', async () => {
  const rows = [{ id: 10, songId: 1, status: 'PENDING', preferredPlayTimeId: 2 }]
  const [item] = binding.selectScheduleReplayBindings([{ songId: 1 }], rows)
  const tx = {
    select() {
      let table
      const query = {
        from(value) { table = value; return query },
        where() { return query },
        orderBy() { return query },
        for() { return query },
        then(resolve) { return Promise.resolve(table === schema.songs ? [{ id: 1, preferredPlayTimeId: 1 }] : rows).then(resolve) }
      }
      return query
    }
  }
  await assert.rejects(placement.assertSchedulePlacement({ playTimeId: 1, items: [item] }, new Map([[1, '歌曲']]), tx),
    (error) => error.statusCode === 400 && error.data.code === codes.SONG_SCHEDULE_PREFERRED_TIME_MISMATCH && error.data.params.length === 1)
  await placement.assertSchedulePlacement({ playTimeId: 2, items: [item] }, undefined, tx)
  rows[0].preferredPlayTimeId = null
  await assert.rejects(placement.assertSchedulePlacement({ playTimeId: 2, items: [item] }, undefined, tx))
  await placement.assertSchedulePlacement({ playTimeId: 1, items: [item] }, undefined, tx)
})

test('履行申请不会将已校验绑定替换为其他待处理申请', async () => {
  const writes = []
  const tx = {
    update(table) {
      let values
      const query = {
        set(value) { values = value; return query },
        where() { writes.push({ table, values }); return query },
        returning() { return Promise.resolve([{ id: 11, userId: 3, createdAt: new Date(0) }]) },
        then(resolve) { return Promise.resolve(undefined).then(resolve) }
      }
      return query
    }
  }
  const result = await binding.fulfillReplayRequestsForSchedule({ tx, songId: 1, scheduleId: 7, at: new Date(0), resolvedRequestId: 10 })
  assert.equal(result.replayRequestId, 10)
  assert.equal(writes.find((write) => write.table === schema.schedules).values.replayRequestId, 10)
  assert.deepEqual(result.replayRequesterIds, [3])
  writes.length = 0
  assert.equal(await binding.fulfillReplayRequestsForSchedule({ tx, songId: 1, scheduleId: 7, at: new Date(0), resolvedRequestId: null }), null)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].table, schema.schedules)
})
