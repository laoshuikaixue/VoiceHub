import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoSchedule,
  autoScheduleExhaustive,
  countExpectedDateHits,
  DEFAULT_EXPECTED_DATE_WEIGHT,
  expectedDateWeightedOrder,
  filterByExpectedPlacement,
  normalizePreferredPlayDate,
  normalizePreferredPlayTimeId
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

test('期望日期是软偏好：非当天的歌曲仍参与本次排期', () => {
  const candidates = [
    mk(1, { preferredPlayDate: '2026-03-18' }),
    mk(2, { preferredPlayDate: '2026-03-19' }),
    mk(3)
  ]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: null })

  assert.deepEqual(res.eligible.map((s) => s.id), [1, 2, 3])
  assert.equal(res.excludedByPlayTime, 0)
})

test('期望日期已过期的歌曲不会被锁死在排期之外', () => {
  const candidates = [mk(1, { preferredPlayDate: '2020-01-01' }), mk(2)]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: 2 })

  assert.deepEqual(res.eligible.map((s) => s.id), [1, 2])
})

test('未设置期望日期/时段的歌曲始终可选', () => {
  const res = filterByExpectedPlacement([mk(1), mk(2)], {
    targetDate: '2026-03-18',
    targetPlayTimeId: 5
  })

  assert.deepEqual(res.eligible.map((s) => s.id), [1, 2])
  assert.equal(res.excludedByPlayTime, 0)
})

test('时段硬约束优先于日期偏好生效', () => {
  const candidates = [mk(1, { preferredPlayDate: '2026-03-19', preferredPlayTimeId: 7 })]
  const res = filterByExpectedPlacement(candidates, { targetDate: '2026-03-18', targetPlayTimeId: 2 })

  assert.equal(res.excludedByPlayTime, 1)
  assert.equal(res.eligible.length, 0)
})

// ------------------------------------------------- expectedDateWeightedOrder

test('命中当天的候选更容易排前面，但不是必然排第一', () => {
  const list = [
    mk(1, { preferredPlayDate: '2026-03-19' }),
    mk(2, { preferredPlayDate: '2026-03-18' }),
    mk(3),
    mk(4, { preferredPlayDate: '2026-03-18' })
  ]
  const RUNS = 400
  let hitFirst = 0
  let missFirst = 0
  const firstSeen = new Set<number>()
  for (let i = 0; i < RUNS; i++) {
    const out = expectedDateWeightedOrder(list, '2026-03-18')
    firstSeen.add(out[0].id)
    if (normalizePreferredPlayDate(out[0].preferredPlayDate) === '2026-03-18') hitFirst++
    else missFirst++
  }

  assert.ok(hitFirst / RUNS > 0.5, `命中日期更常排第一，实际 ${((hitFirst / RUNS) * 100).toFixed(1)}%`)
  assert.ok(missFirst > 0, '不应出现「设了日期就必然排第一」')
  assert.ok(firstSeen.size > 1, '第一位不应总是同一首歌')
})

test('权重为 0 时期望日期不影响排位', () => {
  const list = [
    mk(1, { preferredPlayDate: '2026-03-18' }),
    mk(2),
    mk(3),
    mk(4),
    mk(5)
  ]
  const RUNS = 400
  let hitFirst = 0
  for (let i = 0; i < RUNS; i++) {
    const out = expectedDateWeightedOrder(list, '2026-03-18', 0)
    if (out[0].id === 1) hitFirst++
  }
  const rate = hitFirst / RUNS
  // 5 首等概率时约 20%，允许较宽的随机波动
  assert.ok(rate > 0.1 && rate < 0.32, `权重 0 时应接近纯随机，实际 ${(rate * 100).toFixed(1)}%`)
})

test('默认期望日期权重保持在低位，不会退化成保送', () => {
  assert.ok(DEFAULT_EXPECTED_DATE_WEIGHT > 0, '默认权重应大于 0，日期偏好要有效果')
  assert.ok(DEFAULT_EXPECTED_DATE_WEIGHT <= 0.2, '默认权重不应高到接近必中')
})

test('权重上限守护：日期权重被拉到 1 也不会把非命中候选整体挤到后面', () => {
  const list = [
    mk(1, { preferredPlayDate: '2026-03-18' }),
    mk(2),
    mk(3, { preferredPlayDate: '2026-03-18' }),
    mk(4),
    mk(5)
  ]
  const RUNS = 400
  let interleaved = 0
  for (let i = 0; i < RUNS; i++) {
    // 票数全同 => 热度跨度为 0，非命中组只靠随机分量拉开差距
    const out = expectedDateWeightedOrder(list, '2026-03-18', 1)
    const hitLast = out.map((s) => (s.preferredPlayDate === '2026-03-18' ? 1 : 0)).lastIndexOf(1)
    const missFirst = out.map((s) => (s.preferredPlayDate === '2026-03-18' ? 0 : 1)).indexOf(1)
    if (missFirst < hitLast) interleaved++
  }
  // 无上限守护时命中组恒占前两位，interleaved 为 0；守护后实测约 43%
  assert.ok(
    interleaved / RUNS > 0.2,
    `命中组不应整体前置，实际两组交叠比例 ${((interleaved / RUNS) * 100).toFixed(1)}%`
  )
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

test('autoSchedule 不排除期望日期不是当天的候选', () => {
  const candidates = [
    mk(1, { preferredPlayDate: '2026-03-19', durationSeconds: 300 }),
    mk(2, { preferredPlayDate: '2026-03-18', durationSeconds: 300 }),
    mk(3, { preferredPlayDate: '2026-03-18', durationSeconds: 300 })
  ]
  // 目标 15 分钟 = 三首之和，证明期望日期不符的歌曲仍在候选池内
  const full = autoSchedule('middle', 15, candidates, [], 1, null, null, 0.8, {
    targetDate: '2026-03-18',
    targetPlayTimeId: null
  })
  assert.equal(full.songs.length, 3, '三首歌曲都应参与排期')
})

test('期望日期只提高入选概率：命中组明显更高，但不会全员必上', () => {
  const candidates: Candidate[] = []
  for (let i = 1; i <= 12; i++) {
    // 12 首等长，前 4 首期望当天；目标 800 秒 = 恰好 4 首，名额固定
    candidates.push(mk(i, { preferredPlayDate: i <= 4 ? '2026-03-18' : null }))
  }
  const RUNS = 300
  let hitPicked = 0
  let hitTotal = 0
  let missPicked = 0
  let missTotal = 0
  let runsWithAllHits = 0

  for (let i = 0; i < RUNS; i++) {
    const result = autoSchedule('middle', 800 / 60, candidates, [], 1, null, null, 0.8, {
      targetDate: '2026-03-18',
      targetPlayTimeId: null
    }) as { songs: Candidate[] }
    const picked = new Set(result.songs.map((song) => song.id))
    let hits = 0
    for (const song of candidates) {
      const isHit = song.preferredPlayDate === '2026-03-18'
      if (isHit) {
        hitTotal++
        if (picked.has(song.id)) {
          hitPicked++
          hits++
        }
      } else {
        missTotal++
        if (picked.has(song.id)) missPicked++
      }
    }
    if (hits === 4) runsWithAllHits++
  }

  const hitRate = hitPicked / hitTotal
  const missRate = missPicked / missTotal
  assert.ok(hitRate > missRate * 1.5, `命中组入选率应明显更高，命中 ${(hitRate * 100).toFixed(1)}% / 未命中 ${(missRate * 100).toFixed(1)}%`)
  assert.ok(hitRate > 0.5, `命中组入选率应高于随机，实际 ${(hitRate * 100).toFixed(1)}%`)
  assert.ok(runsWithAllHits < RUNS, '不能出现「4 首全部必上」的结果')
  assert.ok(runsWithAllHits < RUNS * 0.6, `全部命中的比例不应占大多数，实际 ${((runsWithAllHits / RUNS) * 100).toFixed(1)}%`)
})

test('autoScheduleExhaustive 对期望日期同样只加权不保送', () => {
  const candidates: Candidate[] = []
  for (let i = 1; i <= 8; i++) {
    candidates.push(mk(i, { preferredPlayDate: i <= 2 ? '2026-03-18' : null }))
  }
  const RUNS = 120
  let hitPicked = 0
  let hitTotal = 0
  let allHits = 0
  for (let i = 0; i < RUNS; i++) {
    const result = autoScheduleExhaustive('middle', 600 / 60, candidates, [], 1, null, null, 0.8, {
      targetDate: '2026-03-18',
      targetPlayTimeId: null
    }) as { songs: Candidate[] }
    const picked = new Set(result.songs.map((song) => song.id))
    let hits = 0
    for (const song of candidates.filter((c) => c.preferredPlayDate === '2026-03-18')) {
      hitTotal++
      if (picked.has(song.id)) {
        hitPicked++
        hits++
      }
    }
    if (hits === 2) allHits++
  }
  const hitRate = hitPicked / hitTotal
  assert.ok(hitRate > 0.5, `穷举模式下命中组也应更容易入选，实际 ${(hitRate * 100).toFixed(1)}%`)
  assert.ok(allHits < RUNS, '穷举模式下也不能保证命中日期的歌曲全部入选')
})

test('同档抽样不推翻优先级：期望歌曲数达标优先于时长与日期命中', () => {
  // 6 首 240s 设当天 + 14 首 200s 未设；目标 1600s、期望 8 首
  // 同时满足“8 首”和“1600s”的方案只能由 8 首 200s 组成（零命中）；
  // 5 首命中 + 2 首 = 7 首 / 1600s 时长更准但歌曲数不符，不应被抽为方案 1
  const candidates: Candidate[] = []
  for (let i = 1; i <= 6; i++) {
    candidates.push(mk(i, { durationSeconds: 240, preferredPlayDate: '2026-03-18' }))
  }
  for (let i = 7; i <= 20; i++) {
    candidates.push(mk(i, { durationSeconds: 200 }))
  }
  const RUNS = 120
  for (let i = 0; i < RUNS; i++) {
    const result = autoSchedule('middle', 1600 / 60, candidates, [], 1, 8, null, 0.8, {
      targetDate: '2026-03-18',
      targetPlayTimeId: null
    }) as { songs: Candidate[]; absDiff: number }
    assert.equal(result.songs.length, 8, `第 ${i + 1} 次返回 ${result.songs.length} 首，偏离期望的 8 首`)
    assert.equal(result.absDiff, 0, '优先级打平的方案内不应牺牲时长精度')
  }
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
  assert.ok(result.songs.some((s) => s.id === 1 || s.id === 3), '时段匹配的候选应能参与排期')
})

test('autoScheduleExhaustive 同样只把期望日期作为优先而非排除', () => {
  const candidates = [
    mk(1, { preferredPlayDate: '2026-03-19', durationSeconds: 300 }),
    mk(2, { preferredPlayDate: '2026-03-18', durationSeconds: 300 })
  ]
  // 目标 10 分钟 = 两首之和，日期不符的歌曲不应被排除
  const result = autoScheduleExhaustive('middle', 10, candidates, [], 1, null, null, 0.8, {
    targetDate: '2026-03-18',
    targetPlayTimeId: null
  })

  assert.equal(result.songs.length, 2)
})

test('两首同长候选竞争时，命中期望日期的那首更容易被选中', () => {
  const candidates = [
    mk(1, { durationSeconds: 300 }),
    mk(2, { preferredPlayDate: '2026-03-18', durationSeconds: 300 })
  ]
  // 命中概率仅约 53.7%，300 次抽样会有 ~11% 负率低于 0.5，抽样数需足够
  const RUNS = 2000
  let hitPicked = 0
  for (let i = 0; i < RUNS; i++) {
    const result = autoSchedule('middle', 5, candidates, [], 1, null, null, 0.8, {
      targetDate: '2026-03-18',
      targetPlayTimeId: null
    }) as { songs: Candidate[] }
    if (result.songs.some((song) => song.id === 2)) hitPicked++
  }
  const rate = hitPicked / RUNS
  assert.ok(rate > 0.5, `命中日期的那首应更容易被选中，实际 ${(rate * 100).toFixed(1)}%`)
  assert.ok(rate < 1, '不能变成命中日期就必然选中')
})

test('日期偏好不使相差最小方案牺牲时长', () => {
  const candidates = [
    mk(1, { durationSeconds: 300, preferredPlayDate: '2026-03-18' }),
    mk(2, { durationSeconds: 600, preferredPlayDate: '2026-03-18' })
  ]
  for (const algorithm of [autoSchedule, autoScheduleExhaustive]) {
    const result = algorithm('middle', 5, candidates, [], 1, null, null, 0.8, {
      targetDate: '2026-03-18', targetPlayTimeId: null
    })
    assert.ok(!Array.isArray(result))
    assert.equal(result.totalDuration, 300)
    assert.deepEqual(result.songs.map((song) => song.id), [1])
  }
})

test('非当天的精确时长方案优于当天的偏离方案', () => {
  const candidates = [
    mk(1, { durationSeconds: 300 }),
    mk(2, { durationSeconds: 420, preferredPlayDate: '2026-03-18' })
  ]
  for (const algorithm of [autoSchedule, autoScheduleExhaustive]) {
    const result = algorithm('middle', 5, candidates, [], 1, null, null, 0.8, {
      targetDate: '2026-03-18', targetPlayTimeId: null
    })
    assert.ok(!Array.isArray(result))
    assert.equal(result.absDiff, 0)
    assert.equal(result.songs[0].id, 1)
  }
})
