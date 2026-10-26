import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const BEIJING_TIMEZONE = 'Asia/Shanghai'

/** 星期标签权威表：0=周日 … 6=周六 */
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * 时间工具函数
 * 使用 dayjs 处理北京时间（UTC+8）相关逻辑
 *
 * 核心原则：
 * 1. 系统内部传递的 Date 对象保持为真实的 UTC 时间。
 * 2. 数据库中存储的 Timestamp 字段应为真实 UTC 时间。
 * 3. 只有在需要"显示"或"按北京时间逻辑计算（如每日限额）"时，才转换为北京时间处理。
 * 4. 所有"当前时间"均使用同步后的时间（服务端用 getServerTimestamp，客户端用 getSyncedTimestamp）。
 */

/** 获取同步后的当前时间戳 (毫秒) */
function getSyncedNow(): number {
  if (import.meta.server) {
    return (globalThis as any).getServerTimestamp?.() ?? Date.now()
  }
  return (globalThis as any).getSyncedTimestamp?.() ?? Date.now()
}

/**
 * 获取当前时间 (真实 UTC)
 * 使用同步后的时间
 */
export function getBeijingTime(): Date {
  return new Date(getSyncedNow())
}

/**
 * 转换时间 (保留函数签名以兼容旧代码)
 */
export function toBeijingTime(date: Date): Date {
  return date
}

/**
 * 创建北京时间对应的 UTC Date
 */
export function createBeijingTime(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  return dayjs()
    .tz(BEIJING_TIMEZONE)
    .set('year', year)
    .set('month', month)
    .set('date', day)
    .set('hour', hour)
    .set('minute', minute)
    .set('second', second)
    .set('millisecond', 0)
    .toDate()
}

/**
 * 格式化时间为北京时间字符串
 */
export function formatDateTime(date: Date, format: string = 'YYYY/M/D H:mm:ss'): string {
  return dayjs(date).tz(BEIJING_TIMEZONE).format(format)
}

/** 解析接口的 UTC 墙钟字符串或带时区的时间。 */
export function parseUtcTimestamp(value: string | Date): Date {
  if (value instanceof Date) return value
  return dayjs.utc(value).toDate()
}

/**
 * 获取时间戳 (Date 对象)
 */
export function getBeijingTimestamp(): Date {
  return new Date(getSyncedNow())
}

/**
 * 解析北京时间字符串为真实 UTC Date
 */
export function parseToBeijingTime(dateString: string): Date {
  return dayjs.tz(dateString, BEIJING_TIMEZONE).toDate()
}

/**
 * 获取当前北京时间的 ISO 字符串
 */
export function getBeijingTimeISOString(): string {
  return dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * 获取北京时间的日期串（YYYY-MM-DD），用于「今天」边界与按日期比较
 */
export function getBeijingDateString(date?: Date): string {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE)
  return target.format('YYYY-MM-DD')
}

/**
 * 日期串（YYYY-MM-DD）按北京时间对应的星期（0=周日 … 6=周六）；无法解析返回 null
 */
export function getBeijingWeekday(dateString: string): number | null {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null
  const parsed = dayjs.tz(dateString, BEIJING_TIMEZONE)
  return parsed.isValid() ? parsed.day() : null
}

/** 星期数字（0=周日 … 6=周六）→ 中文标签 */
export function getWeekdayLabel(weekday: number | null | undefined): string {
  if (weekday === null || weekday === undefined) return ''
  return WEEKDAY_LABELS[weekday] ?? ''
}

/**
 * 获取北京时间的小时 (0-23)
 */
export function getBeijingHour(date: Date): number {
  return dayjs(date).tz(BEIJING_TIMEZONE).hour()
}

/**
 * 获取"北京时间某天开始"对应的真实 UTC 时间
 */
export function getBeijingStartOfDay(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE)
  return target.startOf('day').toDate()
}

/**
 * 获取"北京时间某天结束"对应的真实 UTC 时间
 */
export function getBeijingEndOfDay(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE)
  return target.endOf('day').toDate()
}

/**
 * 获取"北京时间本周开始"对应的真实 UTC 时间 (周一 00:00:00)
 */
export function getBeijingStartOfWeek(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE)
  const day = target.day()
  const diff = day === 0 ? 6 : day - 1
  return target.subtract(diff, 'day').startOf('day').toDate()
}

/**
 * 获取"北京时间本周结束"对应的真实 UTC 时间 (周日 23:59:59)
 */
export function getBeijingEndOfWeek(date?: Date): Date {
  const startOfWeek = dayjs(getBeijingStartOfWeek(date)).tz(BEIJING_TIMEZONE)
  return startOfWeek.add(6, 'day').endOf('day').toDate()
}

/** 北京时间星期标签，供排期展示统一使用。 */
export function getBeijingWeekdayLabel(date: Date): string {
  return getWeekdayLabel(dayjs(date).tz(BEIJING_TIMEZONE).day())
}

/**
 * 获取"北京时间本月开始"对应的真实 UTC 时间
 */
export function getBeijingStartOfMonth(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE)
  return target.startOf('month').toDate()
}

/**
 * 获取"北京时间本月结束"对应的真实 UTC 时间
 */
export function getBeijingEndOfMonth(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs(getSyncedNow()).tz(BEIJING_TIMEZONE)
  return target.endOf('month').toDate()
}

/**
 * 格式化歌曲/音频时长（秒 → 分:秒 / 时:分:秒）
 */
export function formatDuration(seconds: number): string {
  const total = Number(seconds)
  if (!isFinite(total) || total < 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = Math.floor(total % 60)
  const minuteText = hours > 0 ? minutes.toString().padStart(2, '0') : String(minutes)
  const secondText = secs.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${minuteText}:${secondText}` : `${minuteText}:${secondText}`
}

/**
 * 字符串日期（YYYY-MM-DD）增加指定天数
 */
export function addDaysToString(dateStr: string, days: number): string {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr)
  if (!match) return dateStr
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/**
 * 计算两个字符串日期之间的天数差（end - start）
 * 负数表示 start 晚于 end
 */
export function getDaysBetween(startStr: string, endStr: string): number {
  const startMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(startStr)
  const endMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(endStr)
  if (!startMatch || !endMatch) return -1
  const start = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]))).getTime()
  const end = new Date(Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]))).getTime()
  return Math.round((end - start) / 86400000)
}
