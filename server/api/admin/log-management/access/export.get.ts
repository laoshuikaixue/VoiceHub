import { createError, defineEventHandler, getQuery } from 'h3'
import { and, desc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { apiLogs } from '~/drizzle/schema'
import { formatDateTime, getBeijingTime } from '~/utils/timeUtils'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { buildApiLogConditions, isUuid, readQueryString } from '~~/server/utils/log-query'
import {
  buildCsv,
  buildJsonLines,
  readExportFormat,
  setLogDownloadHeaders
} from '~~/server/utils/log-export'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

// 单次导出上限，避免一次性把全表读入内存
const EXPORT_LIMIT = 20000

const CSV_HEADER = [
  '时间',
  'API Key ID',
  '端点',
  '方法',
  '状态码',
  '响应耗时(ms)',
  'IP',
  'User-Agent',
  '请求体',
  '响应体',
  '错误信息'
]

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const apiKeyId = readQueryString(query.apiKeyId)
    if (apiKeyId && !isUuid(apiKeyId)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'API Key ID 无效')
    }
    const format = readExportFormat(query.format)
    const conditions = buildApiLogConditions(query)
    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select()
      .from(apiLogs)
      .where(whereClause)
      .orderBy(desc(apiLogs.createdAt))
      .limit(EXPORT_LIMIT)

    const payload = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      createdAtDisplay: formatDateTime(row.createdAt)
    }))

    const stamp = formatDateTime(getBeijingTime(), 'YYYYMMDD-HHmmss')
    const filename = `voicehub-api-logs-${stamp}.${format === 'jsonl' ? 'log' : 'csv'}`
    setLogDownloadHeaders(event, format, filename)

    await recordAdminAudit(event, 'logs.export', {
      targetType: 'log',
      targetId: 'api',
      summary: {
        format,
        rows: payload.length,
        needsNarrowing: rows.length >= EXPORT_LIMIT,
        filters: query
      }
    })

    if (format === 'jsonl') return buildJsonLines(payload)

    return buildCsv(
      CSV_HEADER,
      payload.map((row) => [
        row.createdAtDisplay,
        row.apiKeyId,
        row.endpoint,
        row.method,
        row.statusCode,
        row.responseTimeMs,
        row.ipAddress,
        row.userAgent,
        row.requestBody,
        row.responseBody,
        row.errorMessage
      ])
    )
  } catch (error: any) {
    console.error('导出 API 访问日志失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '导出 API 访问日志失败' })
  }
})
