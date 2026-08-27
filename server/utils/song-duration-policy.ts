import { SONG_DURATION_MAX_SECONDS, SONG_DURATION_MIN_SECONDS } from '../config/constants.ts'

/** 时长差异容差（秒），差异不超过此值视为一致 */
export const DURATION_TOLERANCE_SECONDS = 5

export type SongDurationOutcome = 'keep' | 'clear' | 'fill' | 'nocheck'

export interface SongDurationDecision {
  outcome: SongDurationOutcome
  durationSeconds: number | null
}

/** 归一化已有时长：非法值或越出合法区间视为无时长 */
export function normalizeStoredDuration(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const seconds = Math.floor(parsed)
  if (seconds < SONG_DURATION_MIN_SECONDS || seconds > SONG_DURATION_MAX_SECONDS) return null
  return seconds
}

/** 时长决策：库中无值且平台可查则补齐，有值但与平台不符则清空 */
export function decideDurationOutcome(
  storedDurationSeconds: number | null,
  actualDurationSeconds: number | null,
  toleranceSeconds: number = DURATION_TOLERANCE_SECONDS
): SongDurationDecision {
  if (actualDurationSeconds === null) {
    return { outcome: 'nocheck', durationSeconds: storedDurationSeconds }
  }
  if (storedDurationSeconds === null) {
    return { outcome: 'fill', durationSeconds: actualDurationSeconds }
  }
  if (Math.abs(actualDurationSeconds - storedDurationSeconds) > toleranceSeconds) {
    return { outcome: 'clear', durationSeconds: null }
  }
  return { outcome: 'keep', durationSeconds: storedDurationSeconds }
}
