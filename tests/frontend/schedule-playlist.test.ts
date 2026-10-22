import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSchedulePlaybackState, findScheduleItem, reconcileSchedulePlayback,
  sameScheduleSource, scheduleNeighborIndex, selectScheduleItem, isScheduleScopeSaved
} from '../../app/utils/schedulePlaylist.ts'
import { createSchedulePlaylistRefresh } from '../../app/utils/schedulePlaylistRefresh.ts'

const source = { date: '2026-10-20', playTimeId: 1, includeDrafts: true }
const item = (songId: number, id = songId, playTimeId: number | null = 1, replayRequestId: number | null = null) => ({
  id, playDate: source.date, playTimeId, replayRequestId,
  song: { id: songId, title: `歌曲${songId}`, artist: '测试', playUrl: `/audio/${songId}.wav` }
})
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

test('临时队列只在原范围保存后绑定，同日期其他时段及部分日期保存不激活', () => {
  assert.equal(isScheduleScopeSaved(source, { dates: [source.date], playTimeId: 2 }), false)
  assert.equal(isScheduleScopeSaved(source, { dates: ['2026-10-21'], playTimeId: 1 }), false)
  assert.equal(isScheduleScopeSaved(source, { dates: [source.date] }), false)
  assert.equal(isScheduleScopeSaved(source, { dates: [source.date], playTimeId: 1 }), true)
  assert.equal(isScheduleScopeSaved(source, { dates: [source.date], playTimeId: 'all' }), true)
  assert.equal(isScheduleScopeSaved({ ...source, playTimeId: 'all' }, { dates: [source.date], playTimeId: 1 }), false)
})

test('批量保存重建 ID 后按唯一歌曲保持当前项，按最新位置续播', () => {
  const original = [item(1), item(2), item(3), item(4)]
  const state = createSchedulePlaybackState(source, original, 2)
  const next = [item(3, 103), item(1, 101), item(2, 102), item(4, 104)]
  assert.equal(reconcileSchedulePlayback(state, next), 0)
  assert.equal(scheduleNeighborIndex(state, next, 1), 1)
  assert.equal(scheduleNeighborIndex(state, next, -1), -1)
})

test('移除当前项后跨多轮重建保留旧后续顺序，忽略插入当前位置的新曲', () => {
  const original = [item(1), item(2), item(3), item(4)]
  const state = createSchedulePlaybackState(source, original, 1)
  const next = [item(1, 101), item(5, 105), item(3, 103), item(4, 104)]
  assert.equal(reconcileSchedulePlayback(state, next), -1)
  assert.equal(scheduleNeighborIndex(state, next, 1), 2)
  assert.equal(scheduleNeighborIndex(state, next, -1), 0)
  const last = [item(4, 204), item(5, 205)]
  reconcileSchedulePlayback(state, last)
  assert.equal(scheduleNeighborIndex(state, last, 1), 0)
  reconcileSchedulePlayback(state, [item(5, 305)])
  assert.equal(scheduleNeighborIndex(state, [item(5, 305)], 1), -1)
})

test('清空后补歌从新列表首曲衔接，切歌后恢复普通顺序', () => {
  const state = createSchedulePlaybackState(source, [item(1), item(2), item(3)], 1)
  reconcileSchedulePlayback(state, [])
  const next = [item(5), item(3)]
  assert.equal(reconcileSchedulePlayback(state, next), -1)
  assert.equal(scheduleNeighborIndex(state, next, 1), 0)
  assert.equal(scheduleNeighborIndex(state, next, -1), -1)
  selectScheduleItem(state, next, 0)
  assert.equal(state.refill, false)
  assert.equal(scheduleNeighborIndex(state, next, 1), 1)
})

test('重复项优先原 ID 及唯一重播绑定，不跨日期时段猜测身份', () => {
  const current = item(1, 10, 1, 42)
  assert.equal(findScheduleItem(current, [item(1, 11), current]), 1)
  assert.equal(findScheduleItem(current, [item(1, 20, 1, 42), item(1, 21)]), 0)
  assert.equal(findScheduleItem(current, [item(1, 20), item(1, 21)]), -1)
  assert.equal(findScheduleItem(current, [item(1, 20, 2)]), -1)
  assert.equal(findScheduleItem(current, [{ ...item(1), playDate: '2026-10-21' }]), -1)
  assert.equal(findScheduleItem(item(1, 1, null), [item(1, 2, null)]), 0)
  assert.equal(sameScheduleSource(source, { ...source, date: '2026-10-21' }), false)
})

test('绑定只读取一次，空闲不轮询，保存通知合并为串行后续请求', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const requests: ((value: number) => void)[] = []
  const applied: number[] = []
  const refresh = createSchedulePlaylistRefresh({
    load: () => new Promise<number>((resolve) => requests.push(resolve)),
    apply: (value) => applied.push(value), failed: () => {}
  })
  refresh.start()
  requests[0](1)
  await flush()
  t.mock.timers.tick(120_000)
  assert.equal(requests.length, 1)
  void refresh.refresh()
  void refresh.refresh()
  assert.equal(requests.length, 2)
  requests[1](2)
  await flush()
  assert.equal(requests.length, 3)
  requests[2](3)
  await flush()
  t.mock.timers.tick(120_000)
  assert.equal(requests.length, 3)
  void refresh.refresh()
  refresh.stop()
  requests[3](4)
  await flush()
  assert.deepEqual(applied, [1, 3])
})

test('绑定切换时取消旧读取，即使旧请求忽略取消也只应用新请求', async () => {
  const pending: ((value: number) => void)[] = []
  const applied: number[] = []
  const refresh = createSchedulePlaylistRefresh({
    load: () => new Promise<number>((resolve) => pending.push(resolve)),
    apply: (value) => applied.push(value), failed: () => {}
  })
  refresh.start()
  refresh.start()
  pending[0](1)
  await flush()
  assert.equal(pending.length, 2)
  pending[1](2)
  await flush()
  refresh.stop()
  assert.deepEqual(applied, [2])
})

test('读取失败立即报告但不自动重试，下一次保存可重新刷新', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let broken = true
  let calls = 0
  const failures: boolean[] = []
  const applied: number[] = []
  const refresh = createSchedulePlaylistRefresh({
    load: async () => {
      calls++
      if (broken) throw new Error('断网')
      return calls
    },
    apply: value => applied.push(value), failed: (_error, terminal) => failures.push(terminal)
  })
  refresh.start()
  await flush()
  assert.deepEqual(failures, [false])
  t.mock.timers.tick(120_000)
  await flush()
  assert.equal(calls, 1)
  assert.deepEqual(failures, [false])
  broken = false
  await refresh.refresh()
  assert.deepEqual(applied, [2])
  t.mock.timers.tick(120_000)
  await flush()
  assert.equal(calls, 2)
  refresh.stop()
})

for (const status of [401, 403]) {
  test(`认证读取失败 ${status} 后停止，旧绑定不再读取`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let calls = 0
    const failures: boolean[] = []
    const refresh = createSchedulePlaylistRefresh({
      load: async () => {
        calls++
        throw Object.assign(new Error('权限失效'), { statusCode: status })
      },
      apply: () => assert.fail('权限失效后不得更新队列'),
      failed: (_error, terminal) => failures.push(terminal)
    })
    refresh.start()
    await flush()
    await refresh.refresh()
    t.mock.timers.tick(120_000)
    await flush()
    assert.equal(calls, 1)
    assert.deepEqual(failures, [true])
    refresh.stop()
  })
}
