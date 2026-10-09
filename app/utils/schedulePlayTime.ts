// 排期播出时段判定：统计仍绑定具体播出时段的排期数量
export function countSchedulesWithPlayTime(schedules: unknown): number {
  if (!Array.isArray(schedules)) return 0

  return schedules.filter((schedule) => {
    const playTimeId = Number((schedule as { playTimeId?: unknown } | null)?.playTimeId)
    return Number.isInteger(playTimeId) && playTimeId > 0
  }).length
}
