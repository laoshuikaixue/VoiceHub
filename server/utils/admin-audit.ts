import { getHeader } from 'h3'
import type { H3Event } from 'h3'
import { db } from '~/drizzle/db'
import { adminAuditLogs } from '~/drizzle/schema'
import { getClientIP } from '~~/server/utils/ip-utils'
import { redactCredentialPatterns } from '~~/server/utils/astrbot-error-telemetry'
import { runLazyLogRetentionCleanup } from '~~/server/utils/log-retention'

/**
 * 管理员操作审计。
 *
 * 仅记录后台语义化写操作（动作码 + 目标 + 脱敏摘要），不记录全部 API 调用；
 * 与 api_logs（API 层访问日志）互补，不重复。
 *
 * 审计写入是副作用，必须静默失败：任何异常只打日志，不得阻断主业务或抛出。
 */

/** 审计摘要最大字符数，超出即截断，避免单条记录无限膨胀。 */
export const ADMIN_AUDIT_SUMMARY_MAX_CHARS = 2000

/** 审计结果枚举。 */
export const ADMIN_AUDIT_RESULT = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE'
} as const

export type AdminAuditResult = (typeof ADMIN_AUDIT_RESULT)[keyof typeof ADMIN_AUDIT_RESULT]

/** 只保留可安全展示的摘要字段：summary 入库存 JSON 字符串前按此白名单过滤。 */
const SUMMARY_FIELD_MAX_LENGTH = 500

function normalizeSummaryValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.slice(0, SUMMARY_FIELD_MAX_LENGTH)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => normalizeSummaryValue(item))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizeSummaryValue(item)
      if (normalized !== null && normalized !== undefined) out[key] = normalized
    }
    return out
  }
  return String(value).slice(0, SUMMARY_FIELD_MAX_LENGTH)
}

/**
 * 把摘要对象序列化为可入库的 JSON 字符串：
 * 先归一化（限长、剥嵌套），再统一脱敏（凭据样式内容一律屏蔽）。
 */
function serializeSummary(summary: unknown): string | null {
  if (summary === null || summary === undefined) return null
  const normalized = normalizeSummaryValue(summary)
  if (normalized === null || normalized === undefined) return null
  try {
    const text = typeof normalized === 'string' ? normalized : JSON.stringify(normalized)
    // 只做凭据脱敏，不套用群聊摘要的 300 字截断，长度由审计自身的上限控制
    const safe = redactCredentialPatterns(text).slice(0, ADMIN_AUDIT_SUMMARY_MAX_CHARS)
    return safe || null
  } catch {
    return null
  }
}

/**
 * 记录一条管理员操作审计。
 *
 * @param event H3 事件，用于提取操作者/IP/UA
 * @param action 语义动作码，如 `schedule.publish`、`user.status`、`settings.update`
 * @param options 目标类型/ID、脱敏摘要、结果
 */
export async function recordAdminAudit(
  event: H3Event,
  action: string,
  options: {
    targetType?: string
    targetId?: string | number
    summary?: unknown
    result?: AdminAuditResult
  } = {}
): Promise<void> {
  try {
    const user = event.context?.user as
      | { id?: number; username?: string; name?: string | null }
      | undefined

    const summary = serializeSummary(options.summary)

    await db.insert(adminAuditLogs).values({
      actorId: user?.id ?? null,
      actorName: user?.name || user?.username || null,
      action: action.slice(0, 80),
      targetType: options.targetType ? options.targetType.slice(0, 50) : null,
      targetId: options.targetId === undefined ? null : String(options.targetId).slice(0, 200),
      summary,
      ipAddress: getClientIP(event).slice(0, 100),
      userAgent: (getHeader(event, 'user-agent') || '').slice(0, 500),
      result: options.result ?? ADMIN_AUDIT_RESULT.SUCCESS
    })

    // 后台写操作是稳定的低频时机，顺带按小时节流触发一次过期日志清理
    void runLazyLogRetentionCleanup()
  } catch (error) {
    // 审计写入失败不得影响主业务
    console.error(`[AdminAudit] 记录审计失败（action=${action}）:`, error)
  }
}
