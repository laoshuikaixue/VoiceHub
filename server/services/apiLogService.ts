import { db } from '~/drizzle/db'
import { apiKeys, apiLogs } from '~/drizzle/schema'
import { and, count, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'

/**
 * API访问日志服务
 * 提供日志记录、查询和统计功能
 */
export class ApiLogService {
  /**
   * 记录API访问日志
   */
  static async logAccess(logData: {
    apiKeyId: string | null
    endpoint: string
    method: string
    ipAddress: string
    userAgent: string
    statusCode: number
    responseTimeMs: number
    requestBody?: string | null
    responseBody?: string | null
    errorMessage?: string
  }) {
    try {
      console.log(`[ApiLogService] 记录API访问日志:`, {
        apiKeyId: logData.apiKeyId,
        endpoint: logData.endpoint,
        method: logData.method,
        ipAddress: logData.ipAddress,
        statusCode: logData.statusCode,
        responseTimeMs: logData.responseTimeMs,
        userAgent: logData.userAgent?.substring(0, 50) + '...',
        hasError: !!logData.errorMessage
      })

      await db.insert(apiLogs).values({
        apiKeyId: logData.apiKeyId,
        endpoint: logData.endpoint,
        method: logData.method,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        statusCode: logData.statusCode,
        responseTimeMs: logData.responseTimeMs,
        requestBody: logData.requestBody,
        responseBody: logData.responseBody,
        errorMessage: logData.errorMessage
      })

      console.log(`[ApiLogService] API访问日志记录成功`)
    } catch (error) {
      // 静默处理日志记录错误，避免影响主要业务流程
      console.error('[ApiLogService] API访问日志记录失败:', error)
    }
  }

  /**
   * 查询API访问日志
   */
  static async getLogs(options: {
    page?: number
    limit?: number
    apiKeyId?: string
    endpoint?: string
    method?: string
    statusCode?: number
    ipAddress?: string
    startDate?: string
    endDate?: string
    search?: string
  }) {
    const {
      page = 1,
      limit = 20,
      apiKeyId,
      endpoint,
      method,
      statusCode,
      ipAddress,
      startDate,
      endDate,
      search
    } = options

    const offset = (page - 1) * limit
    const whereConditions = []

    // 构建查询条件
    if (apiKeyId) {
      whereConditions.push(eq(apiLogs.apiKeyId, apiKeyId))
    }

    if (endpoint) {
      whereConditions.push(like(apiLogs.endpoint, `%${endpoint}%`))
    }

    if (method) {
      whereConditions.push(eq(apiLogs.method, method.toUpperCase()))
    }

    if (statusCode) {
      whereConditions.push(eq(apiLogs.statusCode, statusCode))
    }

    if (ipAddress) {
      whereConditions.push(like(apiLogs.ipAddress, `%${ipAddress}%`))
    }

    if (startDate) {
      whereConditions.push(gte(apiLogs.createdAt, new Date(startDate)))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      whereConditions.push(lte(apiLogs.createdAt, endDateTime))
    }

    if (search) {
      whereConditions.push(
        or(
          like(apiLogs.endpoint, `%${search}%`),
          like(apiLogs.ipAddress, `%${search}%`),
          like(apiLogs.userAgent, `%${search}%`),
          like(apiLogs.errorMessage, `%${search}%`)
        )
      )
    }

    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined

    // 查询日志数据
    const logsData = await db
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

    // 查询总数
    const totalResult = await db.select({ count: count() }).from(apiLogs).where(whereClause)

    const total = totalResult[0]?.count || 0

    return {
      logs: logsData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * 获取API访问统计信息
   */
  static async getStats(
    options: {
      apiKeyId?: string
      startDate?: string
      endDate?: string
      groupBy?: 'hour' | 'day' | 'month'
    } = {}
  ) {
    const { apiKeyId, startDate, endDate, groupBy = 'day' } = options
    const whereConditions = []

    if (apiKeyId) {
      whereConditions.push(eq(apiLogs.apiKeyId, apiKeyId))
    }

    if (startDate) {
      whereConditions.push(gte(apiLogs.createdAt, new Date(startDate)))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      whereConditions.push(lte(apiLogs.createdAt, endDateTime))
    }

    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined

    // 基础统计
    const basicStats = await db
      .select({
        totalRequests: count(),
        successRequests: count(
          sql`CASE WHEN ${apiLogs.statusCode} >= 200 AND ${apiLogs.statusCode} < 300 THEN 1 END`
        ),
        errorRequests: count(sql`CASE WHEN ${apiLogs.statusCode} >= 400 THEN 1 END`),
        avgResponseTime: sql<number>`ROUND(AVG(${apiLogs.responseTimeMs}), 2)`,
        maxResponseTime: sql<number>`MAX(${apiLogs.responseTimeMs})`,
        minResponseTime: sql<number>`MIN(${apiLogs.responseTimeMs})`
      })
      .from(apiLogs)
      .where(whereClause)

    // 按状态码统计
    const statusCodeStats = await db
      .select({
        statusCode: apiLogs.statusCode,
        count: count()
      })
      .from(apiLogs)
      .where(whereClause)
      .groupBy(apiLogs.statusCode)
      .orderBy(desc(count()))

    // 按端点统计
    const endpointStats = await db
      .select({
        endpoint: apiLogs.endpoint,
        count: count(),
        avgResponseTime: sql<number>`ROUND(AVG(${apiLogs.responseTimeMs}), 2)`
      })
      .from(apiLogs)
      .where(whereClause)
      .groupBy(apiLogs.endpoint)
      .orderBy(desc(count()))
      .limit(10)

    // 按API Key统计
    const apiKeyStats = await db
      .select({
        apiKeyId: apiLogs.apiKeyId,
        apiKeyName: apiKeys.name,
        count: count(),
        avgResponseTime: sql<number>`ROUND(AVG(${apiLogs.responseTimeMs}), 2)`
      })
      .from(apiLogs)
      .leftJoin(apiKeys, eq(apiLogs.apiKeyId, apiKeys.id))
      .where(whereClause)
      .groupBy(apiLogs.apiKeyId, apiKeys.name)
      .orderBy(desc(count()))
      .limit(10)

    // 按时间分组统计
    let timeGroupFormat: string
    switch (groupBy) {
      case 'hour':
        timeGroupFormat = 'YYYY-MM-DD HH24:00:00'
        break
      case 'month':
        timeGroupFormat = 'YYYY-MM-01'
        break
      default:
        timeGroupFormat = 'YYYY-MM-DD'
    }

    const timeStats = await db
      .select({
        time: sql<string>`TO_CHAR(${apiLogs.createdAt}, ${sql.raw(`'${timeGroupFormat}'`)})`
      })
      .from(apiLogs)
      .where(whereClause)
      .groupBy(sql`TO_CHAR(${apiLogs.createdAt}, ${sql.raw(`'${timeGroupFormat}'`)})`)
      .orderBy(sql`TO_CHAR(${apiLogs.createdAt}, ${sql.raw(`'${timeGroupFormat}'`)})`)

    return {
      basic: basicStats[0] || {
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0
      },
      statusCodes: statusCodeStats,
      endpoints: endpointStats,
      apiKeys: apiKeyStats,
      timeline: timeStats
    }
  }

  /**
   * 获取热门端点统计
   */
  static async getPopularEndpoints(
    options: {
      limit?: number
      startDate?: string
      endDate?: string
    } = {}
  ) {
    const { limit = 10, startDate, endDate } = options
    const whereConditions = []

    if (startDate) {
      whereConditions.push(gte(apiLogs.createdAt, new Date(startDate)))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      whereConditions.push(lte(apiLogs.createdAt, endDateTime))
    }

    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined

    return await db
      .select({
        endpoint: apiLogs.endpoint,
        method: apiLogs.method,
        totalRequests: count(),
        successRequests: count(
          sql`CASE WHEN ${apiLogs.statusCode} >= 200 AND ${apiLogs.statusCode} < 300 THEN 1 END`
        ),
        errorRequests: count(sql`CASE WHEN ${apiLogs.statusCode} >= 400 THEN 1 END`),
        avgResponseTime: sql<number>`ROUND(AVG(${apiLogs.responseTimeMs}), 2)`,
        lastAccessed: sql<Date>`MAX(${apiLogs.createdAt})`
      })
      .from(apiLogs)
      .where(whereClause)
      .groupBy(apiLogs.endpoint, apiLogs.method)
      .orderBy(desc(count()))
      .limit(limit)
  }

  /**
   * 获取错误日志统计
   */
  static async getErrorStats(
    options: {
      limit?: number
      startDate?: string
      endDate?: string
    } = {}
  ) {
    const { limit = 10, startDate, endDate } = options
    const whereConditions = [sql`${apiLogs.statusCode} >= 400`]

    if (startDate) {
      whereConditions.push(gte(apiLogs.createdAt, new Date(startDate)))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      whereConditions.push(lte(apiLogs.createdAt, endDateTime))
    }

    const whereClause = and(...whereConditions)

    return await db
      .select({
        errorMessage: apiLogs.errorMessage,
        statusCode: apiLogs.statusCode,
        endpoint: apiLogs.endpoint,
        count: count(),
        lastOccurred: sql<Date>`MAX(${apiLogs.createdAt})`
      })
      .from(apiLogs)
      .where(whereClause)
      .groupBy(apiLogs.errorMessage, apiLogs.statusCode, apiLogs.endpoint)
      .orderBy(desc(count()))
      .limit(limit)
  }

  /**
   * 清理过期日志
   */
  static async cleanupOldLogs(daysToKeep: number = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    try {
      const result = await db.delete(apiLogs).where(lte(apiLogs.createdAt, cutoffDate))

      console.log(`Cleaned up API logs older than ${daysToKeep} days`)
      return result
    } catch (error) {
      console.error('Failed to cleanup old API logs:', error)
      throw error
    }
  }
}
