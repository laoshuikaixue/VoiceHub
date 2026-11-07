import { eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm'
import { adminAuditLogs, apiLogs } from '~/drizzle/schema'
import { getBeijingEndOfDay, parseToBeijingTime } from '~/utils/timeUtils'

/**
 * 日志查询条件构造（列表与导出共用，避免两处筛选口径漂移）。
 * startDate / endDate 为北京日期（YYYY-MM-DD），按北京日界转为 UTC 边界。
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const AUDIT_RESULTS = ['SUCCESS', 'FAILURE']

export function readQueryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function readStatusCode(value: unknown): number | null {
  const statusCode = Number(value)
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : null
}

export function buildApiLogConditions(params: Record<string, unknown>): SQL[] {
  const conditions: SQL[] = []

  const apiKeyId = readQueryString(params.apiKeyId)
  if (apiKeyId) conditions.push(eq(apiLogs.apiKeyId, apiKeyId))

  const endpoint = readQueryString(params.endpoint)
  if (endpoint) conditions.push(ilike(apiLogs.endpoint, `%${endpoint}%`))

  const method = readQueryString(params.method).toUpperCase()
  if (method) conditions.push(eq(apiLogs.method, method))

  const statusCode = readStatusCode(params.statusCode)
  if (statusCode !== null) conditions.push(eq(apiLogs.statusCode, statusCode))

  const ipAddress = readQueryString(params.ipAddress)
  if (ipAddress) conditions.push(ilike(apiLogs.ipAddress, `%${ipAddress}%`))

  const search = readQueryString(params.search)
  if (search) {
    conditions.push(
      or(
        ilike(apiLogs.endpoint, `%${search}%`),
        ilike(apiLogs.ipAddress, `%${search}%`),
        ilike(apiLogs.userAgent, `%${search}%`),
        ilike(apiLogs.errorMessage, `%${search}%`)
      )!
    )
  }

  const startDate = readQueryString(params.startDate)
  if (DATE_PATTERN.test(startDate)) {
    conditions.push(gte(apiLogs.createdAt, parseToBeijingTime(startDate)))
  }
  const endDate = readQueryString(params.endDate)
  if (DATE_PATTERN.test(endDate)) {
    conditions.push(lte(apiLogs.createdAt, getBeijingEndOfDay(parseToBeijingTime(endDate))))
  }

  return conditions
}

export function buildAuditLogConditions(params: Record<string, unknown>): SQL[] {
  const conditions: SQL[] = []

  const action = readQueryString(params.action)
  if (action) conditions.push(ilike(adminAuditLogs.action, `%${action}%`))

  const targetType = readQueryString(params.targetType)
  if (targetType) conditions.push(eq(adminAuditLogs.targetType, targetType))

  const result = readQueryString(params.result).toUpperCase()
  if (AUDIT_RESULTS.includes(result)) conditions.push(eq(adminAuditLogs.result, result))

  const actorName = readQueryString(params.actorName)
  if (actorName) conditions.push(ilike(adminAuditLogs.actorName, `%${actorName}%`))

  const startDate = readQueryString(params.startDate)
  if (DATE_PATTERN.test(startDate)) {
    conditions.push(gte(adminAuditLogs.createdAt, parseToBeijingTime(startDate)))
  }
  const endDate = readQueryString(params.endDate)
  if (DATE_PATTERN.test(endDate)) {
    conditions.push(lte(adminAuditLogs.createdAt, getBeijingEndOfDay(parseToBeijingTime(endDate))))
  }

  return conditions
}
