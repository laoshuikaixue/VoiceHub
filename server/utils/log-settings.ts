import {
  API_LOG_LEVELS,
  DEFAULT_API_LOG_LEVEL,
  LOG_RETENTION_MAX_DAYS
} from '../config/constants.ts'

/** API 访问日志记录级别：off=关闭，errors=仅失败请求，all=全部。 */
export type ApiLogLevel = (typeof API_LOG_LEVELS)[number]

export function normalizeApiLogLevel(value: unknown): ApiLogLevel {
  return (API_LOG_LEVELS as readonly unknown[]).includes(value)
    ? (value as ApiLogLevel)
    : (DEFAULT_API_LOG_LEVEL as ApiLogLevel)
}

export function shouldRecordApiLog(level: ApiLogLevel, statusCode: number): boolean {
  if (level === 'off') return false
  if (level === 'errors') return Number(statusCode) >= 400
  return true
}

/** 保留天数：0 = 永久保留；非法值回退默认。 */
export function normalizeRetentionDays(value: unknown, fallback: number): number {
  const days = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(days) && days >= 0 && days <= LOG_RETENTION_MAX_DAYS ? days : fallback
}
