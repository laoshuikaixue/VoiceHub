/** 已有时长合计与缺失条目数。零或负值不能作为可播放时长。 */
export function summarizeScheduleDuration(entries: readonly { song?: { durationSeconds?: number | null } | null }[]) {
  let seconds = 0
  let unknown = 0
  for (const { song } of entries) {
    const duration = song?.durationSeconds
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) seconds += duration
    else unknown++
  }
  return { seconds, unknown }
}

/** 估算顺播剩余时长，任一待播曲目缺时长时显示未知。 */
export function estimateBroadcastDuration(
  durations: (number | null | undefined)[], elapsed: number, secondsUntilEnd: number, closing: boolean, stopAtEnd: boolean
): number | null {
  let seconds = 0
  for (const [index, duration] of durations.entries()) {
    if (index > 0 && (closing || seconds >= secondsUntilEnd)) break
    if (duration == null || !Number.isFinite(duration) || duration <= 0) return null
    seconds += Math.max(0, duration - (index === 0 ? elapsed : 0))
  }
  return stopAtEnd ? Math.min(seconds, Math.max(0, secondsUntilEnd)) : seconds
}
