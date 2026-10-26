import { getBeijingDateString, getBeijingWeekday } from '~/utils/timeUtils'

/**
 * 播出时段「适用星期」与播出日期的判定规则。
 * 星期口径：0=周日, 1=周一 … 6=周六（与 JS Date#getDay 一致），
 * 时区换算由 timeUtils 统一实现。
 */

/**
 * 规范化「适用星期」输入：仅保留 0-6 的整数并去重排序。
 * 空数组 / null / 非法输入统一返回 null，语义为「每天均可选」（兼容未配置的历史时段）。
 */
export function normalizeWeekdays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const days = [...new Set(value.filter((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6))]
    .sort((a, b) => a - b)
  return days.length > 0 ? days : null
}

/** 该时段在指定星期是否可选（未配置星期 = 每天可选） */
export function slotAppliesToWeekday(weekdays: unknown, weekday: number | null): boolean {
  if (weekday === null) return false
  const days = normalizeWeekdays(weekdays)
  return days === null || days.includes(weekday)
}

/** 计算日期串（YYYY-MM-DD）在北京时间下的星期（0=周日…6=周六）；无法解析返回 null */
export function getWeekdayOfDateString(dateString: string): number | null {
  return getBeijingWeekday(dateString)
}

/** 校验播出日期：必须为 YYYY-MM-DD 且不能早于北京时间今天 */
export function validatePlayDateString(dateString: unknown): { valid: boolean; code?: string } {
  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return { valid: false, code: 'SONG_PLAY_DATE_FORMAT_INVALID' }
  }
  if (getBeijingWeekday(dateString) === null) {
    return { valid: false, code: 'SONG_PLAY_DATE_FORMAT_INVALID' }
  }
  if (dateString < getBeijingDateString()) {
    return { valid: false, code: 'SONG_PLAY_DATE_BEFORE_TODAY' }
  }
  return { valid: true }
}
