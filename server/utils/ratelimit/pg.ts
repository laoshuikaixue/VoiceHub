/**
 * PG 实现速率限制器
 *
 * 固定窗口（按分钟对齐）原子累加，使用 INSERT ... ON CONFLICT DO UPDATE
 * 避免应用层读-改-写竞态。生产压测（spec [S11.2]）不通过时切换到滑动窗口
 * （api_rate_limit_counters 表 + 90s TTL + 累计求和）。
 *
 * 配额（daily / monthly）走同样的 INSERT ... ON CONFLICT 模式，
 * bucket key 分别是 yyyymmdd 和 yyyy mm。
 */

import { sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import {
  apiRateLimitCounters,
  apiUsageDaily,
  apiUsageMonthly
} from '~/drizzle/schema'

const PG_ATOMIC_INSERT_RATE_LIMIT = sql`
  INSERT INTO api_rate_limit_counters (api_key_id, bucket_minute, count)
  VALUES (${apiRateLimitCounters.apiKeyId}, ${apiRateLimitCounters.bucketMinute}, 1)
  ON CONFLICT (api_key_id, bucket_minute)
  DO UPDATE SET count = api_rate_limit_counters.count + 1
  RETURNING count
`

const PG_ATOMIC_INSERT_DAILY = sql`
  INSERT INTO api_usage_daily (api_key_id, usage_date, count)
  VALUES (${apiUsageDaily.apiKeyId}, ${apiUsageDaily.usageDate}, 1)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET count = api_usage_daily.count + 1
  RETURNING count
`

const PG_ATOMIC_INSERT_MONTHLY = sql`
  INSERT INTO api_usage_monthly (api_key_id, usage_month, count)
  VALUES (${apiUsageMonthly.apiKeyId}, ${apiUsageMonthly.usageMonth}, 1)
  ON CONFLICT (api_key_id, usage_month)
  DO UPDATE SET count = api_usage_monthly.count + 1
  RETURNING count
`

/**
 * 把 minute 对齐到当前分钟的开始（UTC）
 */
export function currentMinuteBucket(date = new Date()): Date {
  const d = new Date(date)
  d.setUTCSeconds(0, 0)
  return d
}

/**
 * yyyymmdd 格式（北京时间）
 */
export function currentDailyBucket(date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * yyyymm 格式（北京时间）
 */
export function currentMonthlyBucket(date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

/**
 * 速率限制原子累加并返回当前窗口计数
 */
export async function incrementRateCounter(
  apiKeyId: string,
  bucket = currentMinuteBucket()
): Promise<number> {
  const rows = await db.execute<{ count: number }>(PG_ATOMIC_INSERT_RATE_LIMIT, {
    api_key_id: apiKeyId,
    bucket_minute: bucket
  } as any)
  // drizzle postgres-js 返回 rows[0]
  const row = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  return Number(row?.count ?? 0)
}

/**
 * 日配额原子累加并返回当前计数
 */
export async function incrementDailyCounter(
  apiKeyId: string,
  bucket = currentDailyBucket()
): Promise<number> {
  const rows = await db.execute<{ count: number }>(PG_ATOMIC_INSERT_DAILY, {
    api_key_id: apiKeyId,
    usage_date: bucket
  } as any)
  const row = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  return Number(row?.count ?? 0)
}

/**
 * 月配额原子累加并返回当前计数
 */
export async function incrementMonthlyCounter(
  apiKeyId: string,
  bucket = currentMonthlyBucket()
): Promise<number> {
  const rows = await db.execute<{ count: number }>(PG_ATOMIC_INSERT_MONTHLY, {
    api_key_id: apiKeyId,
    usage_month: bucket
  } as any)
  const row = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0]
  return Number(row?.count ?? 0)
}

/**
 * 综合校验：依次检查 rate_limit / daily / monthly，全部通过返回 null；
 * 任一超限返回包含 Retry-After 的错误结构
 */
export type RateCheckInput = {
  apiKeyId: string
  rateLimitPerMinute: number | null
  quotaDaily: number | null
  quotaMonthly: number | null
}

export type RateCheckResult =
  | { ok: true }
  | {
      ok: false
      status: 429
      reason: 'rate_limit' | 'quota_daily' | 'quota_monthly'
      current: number
      limit: number
      retryAfterSeconds: number
    }

export async function checkAndIncrementRate(
  input: RateCheckInput
): Promise<RateCheckResult> {
  // 每分钟速率限制
  if (input.rateLimitPerMinute != null && input.rateLimitPerMinute > 0) {
    const current = await incrementRateCounter(input.apiKeyId)
    if (current > input.rateLimitPerMinute) {
      const now = new Date()
      const nextMinute = new Date(now)
      nextMinute.setUTCSeconds(0, 0)
      nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1)
      const retryAfter = Math.max(1, Math.ceil((nextMinute.getTime() - now.getTime()) / 1000))
      return {
        ok: false,
        status: 429,
        reason: 'rate_limit',
        current,
        limit: input.rateLimitPerMinute,
        retryAfterSeconds: retryAfter
      }
    }
  }

  // 日配额
  if (input.quotaDaily != null && input.quotaDaily > 0) {
    const current = await incrementDailyCounter(input.apiKeyId)
    if (current > input.quotaDaily) {
      const now = new Date()
      const nextDay = new Date(now)
      nextDay.setUTCHours(24, 0, 0, 0)
      const retryAfter = Math.max(60, Math.ceil((nextDay.getTime() - now.getTime()) / 1000))
      return {
        ok: false,
        status: 429,
        reason: 'quota_daily',
        current,
        limit: input.quotaDaily,
        retryAfterSeconds: retryAfter
      }
    }
  }

  // 月配额
  if (input.quotaMonthly != null && input.quotaMonthly > 0) {
    const current = await incrementMonthlyCounter(input.apiKeyId)
    if (current > input.quotaMonthly) {
      const now = new Date()
      const nextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      const retryAfter = Math.max(3600, Math.ceil((nextMonth.getTime() - now.getTime()) / 1000))
      return {
        ok: false,
        status: 429,
        reason: 'quota_monthly',
        current,
        limit: input.quotaMonthly,
        retryAfterSeconds: retryAfter
      }
    }
  }

  return { ok: true }
}
