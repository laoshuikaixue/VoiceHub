import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const BEIJING_TIMEZONE = 'Asia/Shanghai'

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
    return getServerTimestamp()
  }
  return getSyncedTimestamp()
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
