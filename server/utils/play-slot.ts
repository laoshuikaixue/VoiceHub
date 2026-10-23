import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { getBeijingTimeISOString } from '~/utils/timeUtils'

dayjs.extend(utc)
dayjs.extend(timezone)

const BEIJING_TIMEZONE = 'Asia/Shanghai'

/** 星期取值：0=周日, 1=周一 … 6=周六（与 JS Date#getDay 一致） */
export const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const

/**
 * 规范化「适用星期」输入：仅保留 0-6 的整数并去重排序。
 * 空数组 / null / 非法输入统一返回 null，语义为「每天均可选」（兼容未配置的历史时段）。
 */
export function normalizeWeekdays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const days = [...new Set(value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6))]
    .sort((a, b) => a - b)
  return days.length > 0 ? days : null
}

/** 该时段在指定星期是否可选（未配置星期 = 每天可选） */
export function slotAppliesToWeekday(weekdays: unknown, weekday: number): boolean {
  const days = normalizeWeekdays(weekdays)
  return days === null || days.includes(weekday)
}

/** 当前北京时间日期串（YYYY-MM-DD） */
export function getBeijingDateString(): string {
  return getBeijingTimeISOString().slice(0, 10)
}

/** 计算日期串（YYYY-MM-DD）在 Asia/Shanghai 时区下的星期（0=周日…6=周六） */
export function getWeekdayOfDateString(dateString: string): number {
  return dayjs.tz(dateString, BEIJING_TIMEZONE).day()
}

/** 校验日期串格式与合理性：必须为 YYYY-MM-DD 且不能早于今天（北京时间） */
export function validatePlayDateString(dateString: unknown): { valid: boolean; message?: string } {
  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return { valid: false, message: '播出日期格式不正确，应为 YYYY-MM-DD' }
  }
  const parsed = dayjs.tz(dateString, BEIJING_TIMEZONE)
  if (!parsed.isValid()) {
    return { valid: false, message: '播出日期无效' }
  }
  if (dateString < getBeijingDateString()) {
    return { valid: false, message: '播出日期不能早于今天' }
  }
  return { valid: true }
}
