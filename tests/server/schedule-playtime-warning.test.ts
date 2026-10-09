import test from 'node:test'
import assert from 'node:assert/strict'
import { countSchedulesWithPlayTime } from '../../app/utils/schedulePlayTime.ts'

test('只统计绑定有效播出时段的排期', () => {
  assert.equal(
    countSchedulesWithPlayTime([
      { playTimeId: 1 },
      { playTimeId: 2 },
      { playTimeId: null },
      { playTimeId: 0 },
      { playTimeId: -1 },
      { playTimeId: '3' },
      { playTimeId: 'unknown' },
      null,
      undefined
    ]),
    3
  )
})

test('空数组、null 与非数组都返回 0', () => {
  assert.equal(countSchedulesWithPlayTime([]), 0)
  assert.equal(countSchedulesWithPlayTime(null), 0)
  assert.equal(countSchedulesWithPlayTime(undefined), 0)
  assert.equal(countSchedulesWithPlayTime({ playTimeId: 1 }), 0)
})
