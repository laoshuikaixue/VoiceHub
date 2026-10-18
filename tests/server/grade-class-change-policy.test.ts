import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateGradeClassChangeRules } from '../../server/utils/grade-class-change-policy.ts'

const base = {
  today: '2026-03-10',
  windowStart: null,
  windowEnd: null,
  intervalSatisfied: true,
  semesterChangeCount: 0,
  perSemesterLimit: null
}

test('无限制时允许修改', () => {
  assert.deepEqual(evaluateGradeClassChangeRules(base), { allowed: true })
})

test('窗口起止边界当天允许修改', () => {
  assert.deepEqual(
    evaluateGradeClassChangeRules({ ...base, windowStart: '2026-03-10', windowEnd: '2026-03-10' }),
    { allowed: true }
  )
})

test('早于窗口起始与晚于窗口结束均拒绝', () => {
  assert.deepEqual(evaluateGradeClassChangeRules({ ...base, windowStart: '2026-03-11' }), {
    allowed: false,
    reason: 'window_closed'
  })
  assert.deepEqual(evaluateGradeClassChangeRules({ ...base, windowEnd: '2026-03-09' }), {
    allowed: false,
    reason: 'window_closed'
  })
})

test('间隔不足优先于次数上限', () => {
  const decision = evaluateGradeClassChangeRules({
    ...base,
    intervalSatisfied: false,
    semesterChangeCount: 3,
    perSemesterLimit: 3
  })
  assert.deepEqual(decision, { allowed: false, reason: 'interval_pending' })
})

test('窗口判定优先于间隔判定', () => {
  const decision = evaluateGradeClassChangeRules({
    ...base,
    windowStart: '2026-04-01',
    intervalSatisfied: false
  })
  assert.deepEqual(decision, { allowed: false, reason: 'window_closed' })
})

test('达到学期上限时拒绝，未达上限时允许', () => {
  assert.deepEqual(evaluateGradeClassChangeRules({ ...base, perSemesterLimit: 2, semesterChangeCount: 2 }), {
    allowed: false,
    reason: 'semester_limit_reached'
  })
  assert.deepEqual(evaluateGradeClassChangeRules({ ...base, perSemesterLimit: 2, semesterChangeCount: 1 }), {
    allowed: true
  })
})

test('上限为 null 表示不限次数', () => {
  assert.deepEqual(evaluateGradeClassChangeRules({ ...base, semesterChangeCount: 99 }), { allowed: true })
})
