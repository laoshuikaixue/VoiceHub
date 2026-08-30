import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeRestrictionHours,
  resolveSubmissionRestrictionPolicy
} from '../../server/utils/submission-restriction-policy.ts'

test('时长归一化只接受正整数，其余视为未配置', () => {
  assert.equal(normalizeRestrictionHours(null), null)
  assert.equal(normalizeRestrictionHours(undefined), null)
  assert.equal(normalizeRestrictionHours(''), null)
  assert.equal(normalizeRestrictionHours('abc'), null)
  assert.equal(normalizeRestrictionHours(0), null)
  assert.equal(normalizeRestrictionHours(-3), null)
  assert.equal(normalizeRestrictionHours(1), 1)
  assert.equal(normalizeRestrictionHours('24'), 24)
  assert.equal(normalizeRestrictionHours(24.7), 24)
})

test('关闭重复投稿限制后不做任何限制，普通用户可重复投稿已排期歌曲', () => {
  const policy = resolveSubmissionRestrictionPolicy({
    enableSubmissionRestriction: false,
    sameSongRestrictionHours: null,
    sameArtistRestrictionHours: null,
    submissionRestrictionScope: 'all'
  })
  assert.equal(policy.mode, 'none')
})

test('开关关闭但残留时长也不生效，避免脏数据绕过开关', () => {
  const policy = resolveSubmissionRestrictionPolicy({
    enableSubmissionRestriction: false,
    sameSongRestrictionHours: 48,
    sameArtistRestrictionHours: null
  })
  assert.equal(policy.mode, 'none')
})

test('系统设置缺失时按不限制降级', () => {
  assert.equal(resolveSubmissionRestrictionPolicy(null).mode, 'none')
  assert.equal(resolveSubmissionRestrictionPolicy(undefined).mode, 'none')
  assert.equal(resolveSubmissionRestrictionPolicy({}).mode, 'none')
})

test('开启限制但未配置时长时沿用本学期查重规则', () => {
  const policy = resolveSubmissionRestrictionPolicy({
    enableSubmissionRestriction: true,
    sameSongRestrictionHours: null,
    sameArtistRestrictionHours: null
  })
  assert.equal(policy.mode, 'semester')
})

test('开启限制且时长非法时退回本学期查重规则', () => {
  const policy = resolveSubmissionRestrictionPolicy({
    enableSubmissionRestriction: true,
    sameSongRestrictionHours: 0,
    sameArtistRestrictionHours: 'abc'
  })
  assert.equal(policy.mode, 'semester')
})

test('开启限制且配置时长时按冷却窗口判定', () => {
  const policy = resolveSubmissionRestrictionPolicy({
    enableSubmissionRestriction: true,
    sameSongRestrictionHours: 24,
    sameArtistRestrictionHours: 72,
    submissionRestrictionScope: 'self'
  })
  assert.equal(policy.mode, 'window')
  assert.equal(policy.sameSongHours, 24)
  assert.equal(policy.sameArtistHours, 72)
  assert.equal(policy.scope, 'self')
})

test('限制范围非法值回退为所有人', () => {
  const policy = resolveSubmissionRestrictionPolicy({
    enableSubmissionRestriction: true,
    sameSongRestrictionHours: 24,
    submissionRestrictionScope: 'everyone'
  })
  assert.equal(policy.scope, 'all')
})
