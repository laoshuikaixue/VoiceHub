import assert from 'node:assert/strict'
import test from 'node:test'
import { isPreviewClipDuration } from '../../app/utils/preview-duration.ts'

test('60 秒试听片段相对完整歌曲判定为试听', () => {
  assert.equal(isPreviewClipDuration(60, 248), true)
  assert.equal(isPreviewClipDuration(20, 261), true)
  assert.equal(isPreviewClipDuration(36, 264), true)
  assert.equal(isPreviewClipDuration(90, 248), true)
})

test('时长一致的完整播放不判定为试听', () => {
  assert.equal(isPreviewClipDuration(248, 248), false)
  assert.equal(isPreviewClipDuration(247, 248), false)
  assert.equal(isPreviewClipDuration(262, 264), false)
})

test('短歌与未知时长不参与判定', () => {
  assert.equal(isPreviewClipDuration(60, 90), false)
  assert.equal(isPreviewClipDuration(60, 0), false)
  assert.equal(isPreviewClipDuration(60, null), false)
  assert.equal(isPreviewClipDuration(0, 248), false)
  assert.equal(isPreviewClipDuration(NaN, 248), false)
  assert.equal(isPreviewClipDuration(120, 140), false)
})

test('比例与秒数双阈值同时满足才判定为试听', () => {
  // 差 31 秒但实际时长占 88%，不触发
  assert.equal(isPreviewClipDuration(217, 248), false)
  // 实际时长 80% 以下且差 30 秒以上才触发
  assert.equal(isPreviewClipDuration(198, 248), true)
})
