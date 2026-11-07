import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { adminAuditLogs } from '~/drizzle/schema'
import { and, count, desc, eq, ilike, sql } from 'drizzle-orm'
import { formatDateTime } from '~/utils/timeUtils'
import { resolvePagination } from '~~/server/utils/pagination'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { page, limit, action, targetType, result, actorName, startDate, endDate } = query

    const { page: pageNum, limit: limitNum, offset } = resolvePagination(page, limit, 50, 200)

    const whereConditions = []

    if (action && typeof action === 'string' && action.trim()) {
      whereConditions.push(ilike(adminAuditLogs.action, `%${action.trim()}%`))
    }
    if (targetType && typeof targetType === 'string' && targetType.trim()) {
      whereConditions.push(eq(adminAuditLogs.targetType, targetType.trim()))
    }
    if (result && typeof result === 'string' && ['SUCCESS', 'FAILURE'].includes(result)) {
      whereConditions.push(eq(adminAuditLogs.result, result))
    }
    if (actorName && typeof actorName === 'string' && actorName.trim()) {
      whereConditions.push(ilike(adminAuditLogs.actorName, `%${actorName.trim()}%`))
    }
    // 日期范围按 UTC 边界筛选：startDate/endDate 为 YYYY-MM-DD，按北京日界转 UTC
    if (startDate && typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      whereConditions.push(sql`${adminAuditLogs.createdAt} >= (${startDate}::date - interval '8 hours')`)
    }
    if (endDate && typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      whereConditions.push(sql`${adminAuditLogs.createdAt} < ((${endDate}::date + interval '1 day') - interval '8 hours')`)
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    const totalResult = await db
      .select({ count: count() })
      .from(adminAuditLogs)
      .where(whereClause)
    const total = totalResult[0]?.count || 0

    const logs = await db
      .select({
        id: adminAuditLogs.id,
        actorId: adminAuditLogs.actorId,
        actorName: adminAuditLogs.actorName,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        summary: adminAuditLogs.summary,
        ipAddress: adminAuditLogs.ipAddress,
        userAgent: adminAuditLogs.userAgent,
        result: adminAuditLogs.result,
        createdAt: adminAuditLogs.createdAt
      })
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limitNum)
      .offset(offset)

    return {
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorName: log.actorName,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        summary: log.summary,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        result: log.result,
        createdAt: log.createdAt,
        // 前端一律展示北京时间
        createdAtDisplay: formatDateTime(log.createdAt)
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    console.error('获取审计日志失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '获取审计日志失败: ' + error.message })
  }
})
