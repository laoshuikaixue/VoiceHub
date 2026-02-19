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
 * 1. 系统内部传递的 Date 对象保持为真实的 UTC 时间 (new Date())。
 * 2. 数据库中存储的 Timestamp 字段应为真实 UTC 时间。
 * 3. 只有在需要"显示"或"按北京时间逻辑计算（如每日限额）"时，才转换为北京时间处理。
 *
 * 注意：此前版本可能使用了"偏移后的 Date 对象"（即 UTC 读数等于北京时间的 Date），
 * 本次重构将其纠正为标准模式，以避免混淆和潜在的 Bug。
 */

/**
 * 获取当前时间 (真实 UTC)
 * 用于替代 new Date()，方便统一管理
 */
export function getBeijingTime(): Date {
  return new Date()
}

/**
 * 转换时间 (保留函数签名以兼容旧代码)
 * 直接返回输入的时间，不再进行偏移处理
 */
export function toBeijingTime(date: Date): Date {
  return date
}

/**
 * 创建北京时间对应的 UTC Date
 * 例如：传入 2023, 0, 1, 0, 0, 0 (北京时间 2023-01-01 00:00:00)
 * 返回：UTC 2022-12-31 16:00:00
 */
export function createBeijingTime(
  year: number,
  month: number, // 0-11
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
 * @param date 真实 UTC 时间
 * @param format 格式字符串
 */
export function formatDateTime(date: Date, format: string = 'YYYY/M/D H:mm:ss'): string {
  return dayjs(date).tz(BEIJING_TIMEZONE).format(format)
}

/**
 * 获取时间戳 (真实 UTC)
 */
export function getBeijingTimestamp(): Date {
  return new Date()
}

/**
 * 解析北京时间字符串为真实 UTC Date
 */
export function parseToBeijingTime(dateString: string): Date {
  return dayjs.tz(dateString, BEIJING_TIMEZONE).toDate()
}

/**
 * 获取当前北京时间的 ISO 字符串 (YYYY-MM-DDTHH:mm:ss)
 * 用于与数据库中存储的字符串比较 (requestTimes 表)
 */
export function getBeijingTimeISOString(): string {
  return dayjs().tz(BEIJING_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * 获取北京时间的小时 (0-23)
 */
export function getBeijingHour(date: Date): number {
  return dayjs(date).tz(BEIJING_TIMEZONE).hour()
}

/**
 * 获取“北京时间某天开始”对应的真实 UTC 时间
 * 例如：北京时间 2023-01-02 00:00:00 -> 返回 UTC 2023-01-01 16:00:00
 * @param date 参考日期 (真实 UTC)，默认为当前时间
 */
export function getBeijingStartOfDay(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs().tz(BEIJING_TIMEZONE)
  return target.startOf('day').toDate()
}

/**
 * 获取“北京时间某天结束”对应的真实 UTC 时间
 */
export function getBeijingEndOfDay(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs().tz(BEIJING_TIMEZONE)
  return target.endOf('day').toDate()
}

/**
 * 获取“北京时间本周开始”对应的真实 UTC 时间
 * (周一 00:00:00)
 */
export function getBeijingStartOfWeek(date?: Date): Date {
  const target = date ? dayjs(date).tz(BEIJING_TIMEZONE) : dayjs().tz(BEIJING_TIMEZONE)
  // 处理周一开始 (dayjs 默认周日为 0)
  const day = target.day()
  const diff = day === 0 ? 6 : day - 1
  return target.subtract(diff, 'day').startOf('day').toDate()
}

/**
 * 获取“北京时间本周结束”对应的真实 UTC 时间
 * (周日 23:59:59)
 */
export function getBeijingEndOfWeek(date?: Date): Date {
  // 获取本周开始，然后加 6 天并取结束
  // 注意：这里需要再次转回 dayjs 对象处理
  const startOfWeek = dayjs(getBeijingStartOfWeek(date)).tz(BEIJING_TIMEZONE)
  return startOfWeek.add(6, 'day').endOf('day').toDate()
}
