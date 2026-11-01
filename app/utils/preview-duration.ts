/** 试听片段判定：实际时长低于歌曲时长的比例阈值 */
export const PREVIEW_SHORTFALL_RATIO = 0.8
/** 试听片段判定：实际时长与歌曲时长相差的秒数下限 */
export const PREVIEW_SHORTFALL_SECONDS = 30
/** 只有达到该时长的歌曲才参与试听判定，避免短音频误判 */
export const PREVIEW_MIN_EXPECTED_SECONDS = 120

/**
 * 播放地址是否只是试听片段：实际时长明显短于歌曲时长。
 * 期望时长未知（0/NaN）或不足 2 分钟时不判定。
 */
export function isPreviewClipDuration(
  actualSeconds: unknown,
  expectedSeconds: unknown
): boolean {
  const actual = Number(actualSeconds)
  const expected = Number(expectedSeconds)
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false
  if (actual <= 0 || expected < PREVIEW_MIN_EXPECTED_SECONDS) return false
  return (
    actual < expected * PREVIEW_SHORTFALL_RATIO &&
    expected - actual > PREVIEW_SHORTFALL_SECONDS
  )
}
