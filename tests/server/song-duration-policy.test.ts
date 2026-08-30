import test from 'node:test'
import assert from 'node:assert/strict'
import { decideDurationOutcome, normalizeStoredDuration } from '../../server/utils/song-duration-policy.ts'

test('往期导入搬运时长时按 0–7200 秒区间归一化', () => {
  assert.equal(normalizeStoredDuration(null), null)
  assert.equal(normalizeStoredDuration(undefined), null)
  assert.equal(normalizeStoredDuration(''), null)
  assert.equal(normalizeStoredDuration('abc'), null)
  assert.equal(normalizeStoredDuration(NaN), null)
  assert.equal(normalizeStoredDuration(-1), null)
  assert.equal(normalizeStoredDuration(7201), null)
  assert.equal(normalizeStoredDuration(0), 0)
  assert.equal(normalizeStoredDuration(29), 29)
  assert.equal(normalizeStoredDuration('215'), 215)
  assert.equal(normalizeStoredDuration(3600), 3600)
  assert.equal(normalizeStoredDuration(5400), 5400)
  assert.equal(normalizeStoredDuration(7200), 7200)
})

test('管理员标注的长曲目不再被导入流程静默清空', () => {
  // 旧口径为 30–3600 秒，超 1 小时的曲目会被写成 null
  assert.equal(normalizeStoredDuration(4200), 4200)
})

test('库中无时长且平台可查时补齐', () => {
  assert.deepEqual(decideDurationOutcome(null, 215), { outcome: 'fill', durationSeconds: 215 })
})

test('平台查询失败时保留原值不写库', () => {
  assert.deepEqual(decideDurationOutcome(215, null), { outcome: 'nocheck', durationSeconds: 215 })
  assert.deepEqual(decideDurationOutcome(null, null), { outcome: 'nocheck', durationSeconds: null })
})

test('提交时长与平台差异在容差内视为一致', () => {
  assert.deepEqual(decideDurationOutcome(215, 213), { outcome: 'keep', durationSeconds: 215 })
  assert.deepEqual(decideDurationOutcome(215, 220), { outcome: 'keep', durationSeconds: 215 })
})

test('提交时长与平台差异超过容差时清空', () => {
  assert.deepEqual(decideDurationOutcome(215, 221), { outcome: 'clear', durationSeconds: null })
  assert.deepEqual(decideDurationOutcome(215, 60), { outcome: 'clear', durationSeconds: null })
})
