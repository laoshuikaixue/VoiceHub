import { db, apiUsageDaily, apiUsageMonthly, apiRateLimitCounters } from '~/drizzle/db'
import { and, eq, gte } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

/**
 * API Key 使用统计（spec [S6] / [S11.3]）
 * GET /api/admin/api-keys/[id]/stats
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.API_KEYS_READ)

  const apiKeyId = getRouterParam(event, 'id')
  if (!apiKeyId) {
    throw createError({ statusCode: 400, message: 'API Key ID 不能为空' })
  }

  try {
    const now = new Date()
    // 当前分钟
    const minuteBucket = new Date(now)
    minuteBucket.setUTCSeconds(0, 0)
    const currentMinuteRow = await db
      .select({ count: apiRateLimitCounters.count })
      .from(apiRateLimitCounters)
      .where(
        and(
          eq(apiRateLimitCounters.apiKeyId, apiKeyId),
          eq(apiRateLimitCounters.bucketMinute, minuteBucket)
        )
      )
      .limit(1)
    const currentMinute = currentMinuteRow[0]?.count ?? 0

    // 今日
    const today = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
    const dailyRow = await db
      .select({ count: apiUsageDaily.count })
      .from(apiUsageDaily)
      .where(and(eq(apiUsageDaily.apiKeyId, apiKeyId), eq(apiUsageDaily.usageDate, today)))
      .limit(1)
    const usedToday = dailyRow[0]?.count ?? 0

    // 本月
    const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const monthlyRow = await db
      .select({ count: apiUsageMonthly.count })
      .from(apiUsageMonthly)
      .where(
        and(
          eq(apiUsageMonthly.apiKeyId, apiKeyId),
          eq(apiUsageMonthly.usageMonth, month)
        )
      )
      .limit(1)
    const usedThisMonth = monthlyRow[0]?.count ?? 0

    return {
      success: true,
      data: {
        apiKeyId,
        currentMinute,
        usedToday,
        usedThisMonth,
        asOf: now.toISOString()
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `获取 API Key 统计失败：${error.message}`
    })
  }
})
