import { fetchSongDuration } from '~~/server/utils/songDurationFetcher'

/** 时长差异容差（秒），差异不超过此值视为一致 */
const DURATION_TOLERANCE_SECONDS = 5

/**
 * 校验单首歌曲时长，投稿后立即调用
 * @returns 'keep' | 'clear' | 'nocheck'
 */
export async function validateSongDurationOnSubmit(
  songId: number,
  platform: string | null,
  musicId: string | null,
  storedDurationSeconds: number | null
): Promise<'keep' | 'clear' | 'nocheck'> {
  // 没有提交时长，或没有平台/音乐ID → 无需校验
  if (!storedDurationSeconds || !platform || !musicId) {
    return storedDurationSeconds ? 'nocheck' : 'nocheck'
  }

  try {
    const actualDuration = await fetchSongDuration(platform, musicId)

    if (actualDuration == null) return 'nocheck'

    if (Math.abs(actualDuration - storedDurationSeconds) > DURATION_TOLERANCE_SECONDS) {
      // 差异超过容差 → 清除
      console.log(
        `[投稿校验] #${songId} 时长不符 (提交: ${storedDurationSeconds}s, API: ${actualDuration}s)，清除durationSeconds`
      )
      return 'clear'
    }

    // 时长一致，保留
    return 'keep'
  } catch (error) {
    console.error(`[投稿校验] #${songId} 校验失败:`, error)
    // 校验出错时保留原值，不因为后台问题影响用户投稿
    return 'keep'
  }
}
