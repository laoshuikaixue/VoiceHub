import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoSchedule,
  autoScheduleExhaustive,
  countExpectedDateHits,
  filterByExpectedPlacement,
  normalizePreferredPlayDate,
  normalizePreferredPlayTimeId,
  preferExpectedDate
} from '../../app/utils/autoSchedule.ts'

type Candidate = {
  id: number
  songId: number
  title: string
  artist: string
  durationSeconds: number
  requester: string
  voteCount?: number
  preferredPlayDate?: string | null
  preferredPlayTimeId?: number | null
}

const mk = (
  id: number,
  extra: Partial<Candidate> = {}
): Candidate => ({
  id,
  songId: id,
  title: `s${id}`,
  artist: `a${id}`,
  durationSeconds: 200,
  requester: `u${id}`,
  voteCount: 0,
  ...extra
})

// ---------------------------------------------------------------- 归一化

test('normalizePreferredPlayDate 只保留 YYYY-MM-DD 部分', () => {
  assert.equal(normalizePreferredPlayDate('2026-03-18'), '2026-03-18')
  assert.equal(normalizePreferredPlayDate('2026-03-18T10:00:00Z'), '2026-03-18')
  assert.equal(normalizePreferredPlayDate('  2026-03-18  '), '2026-03-18')
  assert.equal(normalizePreferredPlayDate(null), null)
  assert.equal(normalizePreferredPlayDate(undefined), null)
  assert.equal(normalizePreferredPlayDate(''), null)
  assert.equal(normalizePreferredPlayDate('not-a-date'), null)
})

test('normalizePreferredPlayTimeId 非正整数视为未指定', () => {
  assert.equal(normalizePreferredPlayTimeId(3), 3)
  assert.equal(normalizePreferredPlayTimeId('3'), 3)
  assert.equal(normalizePreferredPlayTimeId(null), null)
  assert.equal(normalizePreferredPlayTimeId(undefined), null)
  assert.equal(normalizePreferredPlayTimeId(''), null)
  assert.equal(normalizePreferredPlayTimeId(0), null)
  assert.equal(normalizePreferredPlayTimeId(-1), null)
  assert.equal(normalizePreferredPlayTimeId(1.5), null)
})

// ------------------------------------------------------- filterByExpectedPlacement

test('期望时段是硬约束：时段不符的歌曲被排除并计数', () => {
  const candidates = [mk(1, { preferredPlayTimeId: 3 }), mk(2, { preferredPlayTimeId: 2 }), mk(3)]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: 2 })

  assert.deepEqual(res.eligible.map((s) => s.id), [2, 3])
  assert.equal(res.excludedByPlayTime, 1)
  assert.equal(res.excludedByDate, 0)
})

test('未指定时段视图下，带期望时段的歌曲不参与排期', () => {
  const candidates = [mk(1, { preferredPlayTimeId: 2 }), mk(2)]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: null })

  assert.deepEqual(res.eligible.map((s) => s.id), [2])
  assert.equal(res.excludedByPlayTime, 1)
})

test('未传 targetPlayTimeId 时不启用时段约束', () => {
  const candidates = [mk(1, { preferredPlayTimeId: 9 }), mk(2)]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18' })

  assert.deepEqual(res.eligible.map((s) => s.id), [1, 2])
  assert.equal(res.excludedByPlayTime, 0)
})

test('期望日期是软约束：非当天的歌曲不参与本次排期并计数', () => {
  const candidates = [
    mk(1, { preferredPlayDate: '2026-03-18' }),
    mk(2, { preferredPlayDate: '2026-03-19' }),
    mk(3)
  ]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: null })

  assert.deepEqual(res.eligible.map((s) => s.id), [1, 3])
  assert.equal(res.excludedByDate, 1)
  assert.equal(res.excludedByPlayTime, 0)
})

test('未设置期望日期/时段的歌曲始终可选', () => {
  const res = filterByExpectedPlacement([mk(1), mk(2)], {
    targetDate: '2026-03-18',
    targetPlayTimeId: 5
  })

  assert.deepEqual(res.eligible.map((s) => s.id), [1, 2])
  assert.equal(res.excludedByDate, 0)
  assert.equal(res.excludedByPlayTime, 0)
})

test('期望时段不符优先于期望日期被判定为时段排除', () => {
  const candidates = [mk(1, { preferredPlayDate: '2026-03-19', preferredPlayTimeId: 7 })]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: 2 })

  assert.equal(res.excludedByPlayTime, 1)
  assert.equal(res.excludedByDate, 0)
  assert.equal(res.eligible.length, 0)
})

// ----------------------------------------------------------- preferExpectedDate

test('preferExpectedDate 把命中目标日期的候选排到最前且保持稳定', () => {
  const list = [
    mk(1, { preferredPlayDate: '2026-03-19' }),
    mk(2, { preferredPlayDate: '2026-03-18' }),
    mk(3),
    mk(4, { preferredPlayDate: '2026-03-18' })
  ]
  const out = preferExpectedDate(list, '2026-03-18')

  assert.deepEqual(out.map((s) => s.id), [2, 4, 1, 3])
})

test('preferExpectedDate 未指定目标日期时保持原顺序', () => {
  const list = [mk(1), mk(2)]
  assert.deepEqual(preferExpectedDate(list, null).map((s) => s.id), [1, 2])
  assert.deepEqual(preferExpectedDate(list, undefined).map((s) => s.id), [1, 2])
})

// ---------------------------------------------------------- countExpectedDateHits

test('countExpectedDateHits 只统计期望日期等于目标日期的歌曲', () => {
  const songs = [
    mk(1, { preferredPlayDate: '2026-03-18' }),
    mk(2, { preferredPlayDate: '2026-03-18T08:00:00Z' }),
    mk(3, { preferredPlayDate: '2026-03-19' }),
    mk(4)
  ]
  assert.equal(countExpectedDateHits(songs, '2026-03-18'), 2)
  assert.equal(countExpectedDateHits(songs, '2026-03-19'), 1)
  assert.equal(countExpectedDateHits(songs, null), 0)
})

// -------------------------------------------------------------- 算法层集成

test('autoSchedule 不会把期望日期不符的歌曲排进当天', () => {
  const candidates = [
    mk(1, { preferredPlayDate: '2026-03-19', durationSeconds: 300 }),
    mk(2, { preferredPlayDate: '2026-03-18', durationSeconds: 300 }),
    mk(3, { preferredPlayDate: '2026-03-18', durationSeconds: 300 })
  ]
  const result = autoSchedule('middle', 10, candidates, [], 1, null, null, 0.8, {
    targetDate: '2026-03-18',
    targetPlayTimeId: null
  })

  assert.ok(result.songs.length > 0)
  assert.ok(
    !result.songs.some((s) => s.id === 1),
    '期望日期为 2026-03-19 的歌曲不应出现在 2026-03-18 的排期中'
  )
  assert.ok(result.songs.some((s) => s.id === 2), '期望日期命中的歌曲应被安排')
})

test('autoSchedule 不会把带期望时段的歌曲排到其它时段', () => {
  const candidates = [
    mk(1, { preferredPlayTimeId: 2, durationSeconds: 300 }),
    mk(2, { preferredPlayTimeId: 3, durationSeconds: 300 }),
    mk(3, { durationSeconds: 300 })
  ]
  const result = autoSchedule('middle', 5, candidates, [], 1, null, null, 0.8, {
    targetDate: '2026-03-18',
    targetPlayTimeId: 2
  })

  assert.ok(result.songs.length > 0)
  assert.ok(!result.songs.some((s) => s.id === 2), '期望时段为 3 的歌曲不应排到时段 2')
  assert.ok(result.songs.some((s) => s.id === 1), '期望时段为 2 的歌曲应被安排')
})

test('autoScheduleExhaustive 同样遵守期望落位约束', () => {
  const candidates = [
    mk(1, { preferredPlayDate: '2026-03-19', durationSeconds: 300 }),
    mk(2, { preferredPlayDate: '2026-03-18', durationSeconds: 300 })
  ]
  const result = autoScheduleExhaustive('middle', 5, candidates, [], 1, null, null, 0.8, {
    targetDate: '2026-03-18',
    targetPlayTimeId: null
  })

  assert.ok(result.songs.length > 0)
  assert.ok(!result.songs.some((s) => s.id === 1))
  assert.ok(result.songs.some((s) => s.id === 2))
})

test('方案比较会优先选择期望日期命中更多的方案', () => {
  const candidates = [
    mk(1, { durationSeconds: 300 }),
    mk(2, { preferredPlayDate: '2026-03-18', durationSeconds: 300 })
  ]
  const result = autoSchedule('middle', 5, candidates, [], 1, null, null, 0.8, {
    targetDate: '2026-03-18',
    targetPlayTimeId: null
  })

  assert.equal(countExpectedDateHits(result.songs, '2026-03-18'), 1, '期望日期命中的歌曲应优先入选')
})
