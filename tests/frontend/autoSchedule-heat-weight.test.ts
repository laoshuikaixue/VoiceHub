import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heatWeightedOrder, buildHeatMap, DEFAULT_HEAT_WEIGHT } from '../../app/utils/autoSchedule'

const mk = (votes: number[]) =>
  votes.map((v, i) => ({
    id: i + 1,
    songId: i + 1,
    title: `s${i + 1}`,
    artist: 'a',
    durationSeconds: 200,
    voteCount: v,
    requester: `u${i}`
  })) as any[]

test('默认热度权重为 80%', () => {
  assert.equal(DEFAULT_HEAT_WEIGHT, 0.8)
})

test('秩归一化：最高票=1、同票同权、低票热度更小', () => {
  const map = buildHeatMap(mk([0, 0, 3, 5, 10]))
  assert.equal(map.get(1), map.get(2), '同票应同权')
  assert.equal(map.get(5), 1, '最高票应是 1')
  // 同票取平均名次：两首 0 票占名次 0、1 → 平均 0.5 → 热度 0.5/4 = 0.125
  assert.equal(map.get(1), 0.125, '最低票组应取平均名次')
  assert.ok((map.get(3) ?? 0) > (map.get(1) ?? 0), '票多热度应更大')
  assert.ok((map.get(3) ?? 0) < 1 && (map.get(3) ?? 0) > 0, '中间票应在 0~1 之间')
  assert.equal(buildHeatMap(mk([7])).get(1), 0.5, '只有一首时取 0.5')
})

test('权重=100% 时退化为严格按票数降序', () => {
  const list = mk([1, 9, 4, 7, 2])
  const out = heatWeightedOrder(list, 1)
  assert.deepEqual(out.map((s) => s.voteCount), [9, 7, 4, 2, 1])
})

test('权重=80%：高票明显靠前，但不是死板排序', () => {
  const list = mk([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  const RUNS = 400
  let topFirst = 0
  let sumTopRank = 0
  let sumBottomRank = 0
  const seenFirst = new Set<number>()
  for (let i = 0; i < RUNS; i++) {
    const out = heatWeightedOrder(list, 0.8)
    if (out[0].voteCount === 9) topFirst++
    seenFirst.add(out[0].voteCount as number)
    sumTopRank += out.findIndex((s) => s.voteCount === 9)
    sumBottomRank += out.findIndex((s) => s.voteCount === 0)
  }
  const avgTop = sumTopRank / RUNS
  const avgBottom = sumBottomRank / RUNS
  assert.ok(avgTop < 0.6, `最高票平均名次应靠前，实际 ${avgTop.toFixed(2)}`)
  assert.ok(avgBottom > 8, `最低票平均名次应靠后，实际 ${avgBottom.toFixed(2)}`)
  assert.ok(topFirst / RUNS > 0.6, `最高票排第一的比例应超过 60%，实际 ${(topFirst / RUNS * 100).toFixed(1)}%`)
  assert.ok(topFirst / RUNS < 1, '不应 100% 固定（否则等于严格排序）')
  assert.ok(seenFirst.size > 1, '第一位不应总是同一首歌')
})

test('权重=0% 时接近纯随机（名次分布均匀）', () => {
  const list = mk([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  const RUNS = 400
  let sumTopRank = 0
  for (let i = 0; i < RUNS; i++) {
    sumTopRank += heatWeightedOrder(list, 0).findIndex((s) => s.voteCount === 9)
  }
  const avgTop = sumTopRank / RUNS
  assert.ok(avgTop > 3 && avgTop < 6, `纯随机时最高票平均名次应接近中间(≈4.5)，实际 ${avgTop.toFixed(2)}`)
})
