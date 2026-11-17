import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { adminAuditLogs } from '~/drizzle/schema'
import { count, desc } from 'drizzle-orm'

// 仅返回筛选下拉所需的聚合，避免每次打开页面都做多余的分组查询
export default defineEventHandler(async () => {
  try {
    const byAction = await db
      .select({
        action: adminAuditLogs.action,
        count: count()
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.action)
      .orderBy(desc(count()))

    const byTargetType = await db
      .select({
        targetType: adminAuditLogs.targetType,
        count: count()
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.targetType)
      .orderBy(desc(count()))

    return {
      success: true,
      data: { byAction, byTargetType }
    }
  } catch (error: any) {
    console.error('获取审计日志统计失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '获取审计日志统计失败' })
  }
})
