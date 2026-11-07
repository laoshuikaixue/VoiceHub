import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { adminAuditLogs } from '~/drizzle/schema'
import { count, desc, sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  try {
    // 按动作聚合（供筛选下拉与统计）
    const byAction = await db
      .select({
        action: adminAuditLogs.action,
        count: count()
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.action)
      .orderBy(desc(count()))

    // 按目标类型聚合
    const byTargetType = await db
      .select({
        targetType: adminAuditLogs.targetType,
        count: count()
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.targetType)
      .orderBy(desc(count()))

    // 按结果聚合
    const byResult = await db
      .select({
        result: adminAuditLogs.result,
        count: count()
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.result)
      .orderBy(desc(count()))

    // 最近 7 天按日聚合（北京时间日期）
    const byDay = await db
      .select({
        day: sql<string>`TO_CHAR((${adminAuditLogs.createdAt} + interval '8 hours')::date, 'YYYY-MM-DD')`,
        count: count()
      })
      .from(adminAuditLogs)
      .where(sql`${adminAuditLogs.createdAt} >= (now() - interval '7 days')`)
      .groupBy(sql`((${adminAuditLogs.createdAt} + interval '8 hours')::date)`)
      .orderBy(sql`((${adminAuditLogs.createdAt} + interval '8 hours')::date)`)

    return {
      success: true,
      data: {
        byAction,
        byTargetType,
        byResult,
        byDay
      }
    }
  } catch (error) {
    console.error('获取审计日志统计失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '获取审计日志统计失败: ' + error.message })
  }
})
