/**
 * 时间工具函数
 * 处理北京时间（UTC+8）相关操作
 */

/**
 * 获取当前北京时间
 * @returns Date 北京时间的Date对象
 */
export function getBeijingTime(): Date {
    const now = new Date()
    // 直接基于当前时间戳，加上北京时区与本地时区的差值
    // 北京时间是UTC+8，所以需要加8小时，再减去本地时区偏移
    const beijingOffset = 8 * 60 // 北京时区偏移（分钟）
    const localOffset = now.getTimezoneOffset() // 本地时区偏移（分钟，UTC-本地时间）
    const offsetDiff = (beijingOffset + localOffset) * 60000 // 转换为毫秒
    return new Date(now.getTime() + offsetDiff)
}

/**
 * 将任意时间转换为北京时间
 * @param date 输入的时间
 * @returns Date 转换后的北京时间
 */
export function toBeijingTime(date: Date): Date {
    // 直接基于输入时间戳，加上北京时区与本地时区的差值
    // 北京时间是UTC+8，所以需要加8小时，再减去本地时区偏移
    const beijingOffset = 8 * 60 // 北京时区偏移（分钟）
    const localOffset = date.getTimezoneOffset() // 本地时区偏移（分钟，UTC-本地时间）
    const offsetDiff = (beijingOffset + localOffset) * 60000 // 转换为毫秒
    return new Date(date.getTime() + offsetDiff)
}

/**
 * 创建北京时间的Date对象
 * @param year 年
 * @param month 月（0-11）
 * @param day 日
 * @param hour 时（可选，默认0）
 * @param minute 分（可选，默认0）
 * @param second 秒（可选，默认0）
 * @returns Date 北京时间的Date对象
 */
export function createBeijingTime(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0
): Date {
    // 创建UTC时间，然后转换为北京时间
    const utcTime = new Date(Date.UTC(year, month, day, hour, minute, second))
    return toBeijingTime(utcTime)
}

/**
 * 格式化北京时间为字符串
 * @param date 时间对象
 * @param format 格式类型，默认为'YYYY/M/D H:mm:ss'
 * @returns string 格式化后的时间字符串
 */
export function formatBeijingTime(date: Date, format: string = 'YYYY/M/D H:mm:ss'): string {
    const beijingTime = toBeijingTime(date)

    const year = beijingTime.getFullYear()
    const month = beijingTime.getMonth() + 1
    const day = beijingTime.getDate()
    const hours = beijingTime.getHours()
    const minutes = beijingTime.getMinutes().toString().padStart(2, '0')
    const seconds = beijingTime.getSeconds().toString().padStart(2, '0')

    if (format === 'YYYY/M/D H:mm:ss') {
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
    }

    if (format === 'YYYY-MM-DD') {
        const monthPadded = month.toString().padStart(2, '0')
        const dayPadded = day.toString().padStart(2, '0')
        return `${year}-${monthPadded}-${dayPadded}`
    }

    // 默认格式
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 获取北京时间的时间戳（用于数据库存储）
 * @returns Date 当前北京时间的Date对象，可直接用于数据库存储
 */
export function getBeijingTimestamp(): Date {
    return getBeijingTime()
}

/**
 * 解析日期字符串并转换为北京时间
 * @param dateString 日期字符串
 * @returns Date 北京时间的Date对象
 */
export function parseToBeijingTime(dateString: string): Date {
    const parsedDate = new Date(dateString)
    return toBeijingTime(parsedDate)
}