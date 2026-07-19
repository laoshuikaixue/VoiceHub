import { getRequestHeader } from 'h3'
import { db, passwordAuditLogs } from '~/drizzle/db'
import { sql } from 'drizzle-orm'
import { getClientIP } from '~~/server/utils/ip-utils'

export const PASSWORD_AUDIT_ACTIONS = {
  INITIAL_PASSWORD: 'INITIAL_PASSWORD',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  RESET_PASSWORD: 'RESET_PASSWORD'
} as const

const PASSWORD_RATE_WINDOW_SECONDS = 10 * 60

export async function consumePasswordRateLimit(
  userId: number,
  ipAddress: string,
  action: string,
  limit: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + PASSWORD_RATE_WINDOW_SECONDS * 1000)
  // 原生 SQL 不经过 Drizzle 的 timestamp 编码器，必须传入字符串以兼容 postgres-js。
  const nowValue = now.toISOString()
  const resetAtValue = resetAt.toISOString()
  const keys = [`user:${action}:${userId}`, `ip:${action}:${ipAddress}`]

  const counts = await db.transaction(async (tx) => {
    const values: number[] = []
    for (const key of keys) {
      const result = await tx.execute(sql`
        INSERT INTO "PasswordRateLimit" ("key", "count", "resetAt")
        VALUES (${key}, 1, ${resetAtValue})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "PasswordRateLimit"."resetAt" <= ${nowValue} THEN 1
            ELSE "PasswordRateLimit"."count" + 1
          END,
          "resetAt" = CASE
            WHEN "PasswordRateLimit"."resetAt" <= ${nowValue} THEN ${resetAtValue}
            ELSE "PasswordRateLimit"."resetAt"
          END
        RETURNING "count"
      `)
      values.push(Number((result as any[])[0]?.count || 1))
    }

    // 惰性清理过期键，避免攻击者通过大量伪造 IP 使限流表无限增长。
    if (Math.random() < 0.02) {
      await tx.execute(sql`DELETE FROM "PasswordRateLimit" WHERE "resetAt" <= ${nowValue}`)
    }

    return values
  })

  const [userCount, ipCount] = counts

  return {
    allowed: userCount <= limit && ipCount <= limit * 3,
    retryAfterSeconds: PASSWORD_RATE_WINDOW_SECONDS
  }
}

export async function recordPasswordAudit(
  event: any,
  userId: number,
  action: string,
  success: boolean,
  failureReason?: string
): Promise<void> {
  try {
    await db.insert(passwordAuditLogs).values({
      userId,
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
