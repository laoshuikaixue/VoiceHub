import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExpectedDurationSeconds,
  isPreviewAudioUrl,
  isPreviewClipDuration,
  normalizeDurationSeconds,
  PREVIEW_PRONE_PLATFORMS
} from '../../app/utils/preview-duration.ts'

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

test('时长归一化：秒直传、毫秒转换、非法值归零', () => {
  assert.equal(normalizeDurationSeconds(250), 250)
  assert.equal(normalizeDurationSeconds(250000), 250)
  assert.equal(normalizeDurationSeconds('250'), 250)
  assert.equal(normalizeDurationSeconds(0), 0)
  assert.equal(normalizeDurationSeconds(-5), 0)
  assert.equal(normalizeDurationSeconds(null), 0)
  assert.equal(normalizeDurationSeconds(undefined), 0)
  assert.equal(normalizeDurationSeconds(NaN), 0)
})

test('期望时长提取：rawItem.durationSeconds 优先，其次 rawItem.duration，最后 musicInfo.duration', () => {
  assert.equal(getExpectedDurationSeconds({ rawItem: { durationSeconds: 250, duration: 100 }, duration: 60 }), 250)
  assert.equal(getExpectedDurationSeconds({ rawItem: { duration: 240 }, duration: 60 }), 240)
  assert.equal(getExpectedDurationSeconds({ duration: 200 }), 200)
  assert.equal(getExpectedDurationSeconds({ rawItem: { durationSeconds: 250000 } }), 250)
  assert.equal(getExpectedDurationSeconds({ rawItem: null }), 0)
  assert.equal(getExpectedDurationSeconds(null), 0)
  assert.equal(getExpectedDurationSeconds(undefined), 0)
})

test('预检门禁：期望时长不足时不探测直接放行', async () => {
  // 期望时长未知或短歌不触发探测（node 环境无 Audio，走到探测会报错）
  assert.equal(await isPreviewAudioUrl('https://example.com/a.mp3', 0), false)
  assert.equal(await isPreviewAudioUrl('https://example.com/a.mp3', 90), false)
  assert.equal(await isPreviewAudioUrl('', 250), false)
})

test('预检平台白名单：仅 tencent 与 netease', () => {
  assert.deepEqual([...PREVIEW_PRONE_PLATFORMS], ['tencent', 'netease'])
})
