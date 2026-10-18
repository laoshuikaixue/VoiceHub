// 学生自助修改年级班级的限制判定；纯函数，不依赖数据库与时区工具，便于单测

export type GradeClassChangeDeniedReason =
  | 'window_closed'
  | 'interval_pending'
  | 'semester_limit_reached'

export type GradeClassChangeDecision =
  | { allowed: true }
  | { allowed: false; reason: GradeClassChangeDeniedReason }

export type GradeClassChangeRules = {
  // 北京时间日期，格式 YYYY-MM-DD
  today: string
  windowStart: string | null
  windowEnd: string | null
  // 距上次自助修改是否已满足最小间隔天数，由调用方在数据库侧比较得出
  intervalSatisfied: boolean
  semesterChangeCount: number
  perSemesterLimit: number | null
}

/**
 * 依次判定日期窗口、最小间隔、每学期次数上限。
 * 窗口与上限的空值均表示不限制；日期按 YYYY-MM-DD 字典序比较即等价于时间序。
 */
export function evaluateGradeClassChangeRules(rules: GradeClassChangeRules): GradeClassChangeDecision {
  const outsideWindow =
    Boolean(rules.windowStart && rules.today < rules.windowStart) ||
    Boolean(rules.windowEnd && rules.today > rules.windowEnd)
  if (outsideWindow) return { allowed: false, reason: 'window_closed' }

  if (!rules.intervalSatisfied) return { allowed: false, reason: 'interval_pending' }

  if (rules.perSemesterLimit !== null && rules.semesterChangeCount >= rules.perSemesterLimit) {
    return { allowed: false, reason: 'semester_limit_reached' }
  }

  return { allowed: true }
}
