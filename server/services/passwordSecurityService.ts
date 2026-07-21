import { getRequestHeader } from 'h3'
import { db } from '~/drizzle/db'
import { passwordAuditLogs, passwordRateLimits } from '~/drizzle/schema'
import { lte, sql } from 'drizzle-orm'
import { getClientIP } from '~~/server/utils/ip-utils'

export const PASSWORD_AUDIT_ACTIONS = {
  INITIAL_PASSWORD: 'INITIAL_PASSWORD',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  RESET_PASSWORD: 'RESET_PASSWORD'
} as const

const PASSWORD_RATE_WINDOW_SECONDS = 10 * 60
const PASSWORD_IP_LIMIT_MULTIPLIER = 20

export async function consumePasswordRateLimit(
  userId: number,
  ipAddress: string,
  action: string,
  limit: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + PASSWORD_RATE_WINDOW_SECONDS * 1000)
  const keys = [`user:${action}:${userId}`, `ip:${action}:${ipAddress}`]
  const comparisonNow = sql.param(now, passwordRateLimits.resetAt)

  const buckets = await db.transaction(async (tx) => {
    const values: Array<{ count: number; resetAt: Date }> = []
    for (const key of keys) {
      // 使用 Node 统一生成的时间，并通过时间列编码器传入 SQL，避免数据库时区影响比较结果。
      const [result] = await tx
        .insert(passwordRateLimits)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: passwordRateLimits.key,
          set: {
            count: sql<number>`CASE
              WHEN ${passwordRateLimits.resetAt} <= ${comparisonNow} THEN 1
              ELSE ${passwordRateLimits.count} + 1
            END`,
            resetAt: sql<Date>`CASE
              WHEN ${passwordRateLimits.resetAt} <= ${comparisonNow} THEN excluded."resetAt"
              ELSE ${passwordRateLimits.resetAt}
            END`
          }
        })
        .returning({
          count: passwordRateLimits.count,
          resetAt: passwordRateLimits.resetAt
        })

      values.push({
        count: result?.count ?? 1,
        resetAt: result?.resetAt ?? resetAt
      })
    }

    // 惰性清理过期键，避免攻击者通过大量伪造 IP 使限流表无限增长。
    if (Math.random() < 0.02) {
      await tx.delete(passwordRateLimits).where(lte(passwordRateLimits.resetAt, now))
    }

    return values
  })

  const [userBucket, ipBucket] = buckets
  const exceededBuckets = [
    userBucket && userBucket.count > limit ? userBucket : null,
    ipBucket && ipBucket.count > limit * PASSWORD_IP_LIMIT_MULTIPLIER ? ipBucket : null
  ].filter((bucket): bucket is { count: number; resetAt: Date } => !!bucket)
  const retryAfterSeconds = exceededBuckets.length
    ? Math.max(
        1,
        ...exceededBuckets.map((bucket) =>
          Math.ceil((new Date(bucket.resetAt).getTime() - now.getTime()) / 1000)
        )
      )
    : 0

  return {
    allowed: exceededBuckets.length === 0,
    retryAfterSeconds
  }
}

export async function recordPasswordAudit(
  event: any,
  userId: number,
  action: string,
  success: boolean,
  failureReason?: string,
  actorId?: number | null
): Promise<void> {
  try {
    await db.insert(passwordAuditLogs).values({
      userId,
      actorId: actorId ?? null,
      action,
      success,
      ipAddress: getClientIP(event),
      userAgent: getRequestHeader(event, 'user-agent') || null,
      failureReason: failureReason || null
    })
  } catch (error) {
    // 审计失败不应覆盖密码操作结果，但必须保留服务端告警便于补偿。
    console.error('[PasswordAudit] 写入密码审计日志失败:', error)
  }
}

export function getPasswordAuditContext(event: any) {
  return {
    ipAddress: getClientIP(event),
    userAgent: getRequestHeader(event, 'user-agent') || null
  }
}
