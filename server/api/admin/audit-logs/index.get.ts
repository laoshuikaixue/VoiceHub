import { createError, defineEventHandler, getQuery } from 'h3'
import { and, count, desc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { adminAuditLogs } from '~/drizzle/schema'
import { formatDateTime } from '~/utils/timeUtils'
import { resolvePagination } from '~~/server/utils/pagination'
import { buildAuditLogConditions } from '~~/server/utils/log-query'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { page, limit, offset } = resolvePagination(query.page, query.limit, 50, 200)

    const conditions = buildAuditLogConditions(query)
    const whereClause = conditions.length ? and(...conditions) : undefined

    const [totalResult, logs] = await Promise.all([
      db.select({ count: count() }).from(adminAuditLogs).where(whereClause),
      db
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
        .limit(limit)
        .offset(offset)
    ])

    const total = totalResult[0]?.count || 0

    return {
      success: true,
      logs: logs.map((log) => ({
        ...log,
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
    console.error('获取审计日志失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '获取审计日志失败' })
  }
})
