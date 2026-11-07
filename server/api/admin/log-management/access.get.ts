import { createError, defineEventHandler, getQuery } from 'h3'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { apiKeys, apiLogs } from '~/drizzle/schema'
import { formatDateTime } from '~/utils/timeUtils'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { resolvePagination } from '~~/server/utils/pagination'
import { buildApiLogConditions, isUuid, readQueryString } from '~~/server/utils/log-query'

// 列表只返回正文预览，完整内容通过导出获取，避免大字段撑爆响应
const BODY_PREVIEW_MAX_CHARS = 1000

function preview(value: string | null): string | null {
  if (!value) return value
  return value.length > BODY_PREVIEW_MAX_CHARS ? `${value.slice(0, BODY_PREVIEW_MAX_CHARS)}…` : value
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const apiKeyId = readQueryString(query.apiKeyId)
    if (apiKeyId && !isUuid(apiKeyId)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'API Key ID 无效')
    }
    const { page, limit, offset } = resolvePagination(query.page, query.limit, 50, 200)

    const conditions = buildApiLogConditions(query)
    const whereClause = conditions.length ? and(...conditions) : undefined

    const [totalResult, logs] = await Promise.all([
      db.select({ count: count() }).from(apiLogs).where(whereClause),
      db
        .select({
          id: apiLogs.id,
          apiKeyId: apiLogs.apiKeyId,
          apiKeyName: apiKeys.name,
          endpoint: apiLogs.endpoint,
          method: apiLogs.method,
          ipAddress: apiLogs.ipAddress,
          userAgent: apiLogs.userAgent,
          statusCode: apiLogs.statusCode,
          responseTimeMs: apiLogs.responseTimeMs,
          requestBody: apiLogs.requestBody,
          responseBody: apiLogs.responseBody,
          errorMessage: apiLogs.errorMessage,
          createdAt: apiLogs.createdAt
        })
        .from(apiLogs)
        .leftJoin(apiKeys, eq(apiLogs.apiKeyId, apiKeys.id))
        .where(whereClause)
        .orderBy(desc(apiLogs.createdAt))
        .limit(limit)
        .offset(offset)
    ])

    const total = totalResult[0]?.count || 0

    return {
      success: true,
      logs: logs.map((log) => ({
        ...log,
        requestBody: preview(log.requestBody),
        responseBody: preview(log.responseBody),
        // 前端一律展示北京时间
        createdAtDisplay: formatDateTime(log.createdAt)
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  } catch (error: any) {
    console.error('获取 API 访问日志失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '获取 API 访问日志失败' })
  }
})
