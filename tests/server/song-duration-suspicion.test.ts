import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SUSPICIOUS_DURATION_SECONDS,
  isSuspiciousSongDuration
} from '../../app/utils/song-duration.ts'

test('试听片段阈值固定为 90 秒', () => {
  assert.equal(SUSPICIOUS_DURATION_SECONDS, 90)
})

test('常见试听片段长度判定为可疑', () => {
  assert.equal(isSuspiciousSongDuration(20), true)
  assert.equal(isSuspiciousSongDuration(30), true)
  assert.equal(isSuspiciousSongDuration(48), true)
  assert.equal(isSuspiciousSongDuration(60), true)
  assert.equal(isSuspiciousSongDuration(90), true)
})

test('正常歌曲时长不判定为可疑', () => {
  assert.equal(isSuspiciousSongDuration(91), false)
  assert.equal(isSuspiciousSongDuration(215), false)
  assert.equal(isSuspiciousSongDuration(3600), false)
})

test('缺失或非法时长不判定为可疑', () => {
  assert.equal(isSuspiciousSongDuration(null), false)
  assert.equal(isSuspiciousSongDuration(undefined), false)
  assert.equal(isSuspiciousSongDuration(''), false)
  assert.equal(isSuspiciousSongDuration('abc'), false)
  assert.equal(isSuspiciousSongDuration(NaN), false)
  assert.equal(isSuspiciousSongDuration(0), false)
  assert.equal(isSuspiciousSongDuration(-10), false)
})
