/** 疑似试听片段的时长上限（秒） */
export const SUSPICIOUS_DURATION_SECONDS = 90

/** 时长是否疑似试听片段：正数且不超过上限 */
export function isSuspiciousSongDuration(durationSeconds: unknown): boolean {
  if (durationSeconds === null || durationSeconds === undefined || durationSeconds === '') {
    return false
  }
  const seconds = Number(durationSeconds)
  return Number.isFinite(seconds) && seconds > 0 && seconds <= SUSPICIOUS_DURATION_SECONDS
}
