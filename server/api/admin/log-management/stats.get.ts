import { createError, defineEventHandler } from 'h3'
import { count, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { apiLogs } from '~/drizzle/schema'
import { formatDateTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  try {
    const [summaryResult, oldestResult, newestResult] = await Promise.all([
      db
        .select({
          total: count(),
          errors: count(sql`CASE WHEN ${apiLogs.statusCode} >= 400 THEN 1 END`),
          avgResponseTime: sql<number>`COALESCE(ROUND(AVG(${apiLogs.responseTimeMs}), 2), 0)`
        })
        .from(apiLogs),
      db.select({ createdAt: apiLogs.createdAt }).from(apiLogs).orderBy(apiLogs.createdAt).limit(1),
      db
        .select({ createdAt: apiLogs.createdAt })
        .from(apiLogs)
        .orderBy(sql`${apiLogs.createdAt} DESC`)
        .limit(1)
    ])

    const summary = summaryResult[0]
    const oldest = oldestResult[0]?.createdAt
    const newest = newestResult[0]?.createdAt

    return {
      success: true,
      data: {
        total: summary?.total || 0,
        errors: summary?.errors || 0,
        avgResponseTime: summary?.avgResponseTime || 0,
        oldestAt: oldest ? formatDateTime(oldest) : null,
        newestAt: newest ? formatDateTime(newest) : null
      }
    }
  } catch (error: any) {
    console.error('获取日志统计失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '获取日志统计失败' })
  }
})
