import { getRequestHeader, type H3Event } from 'h3'
import { db } from '~/drizzle/db'
import { adminOperationLogs } from '~/drizzle/schema'
import { getClientIP } from '~~/server/utils/ip-utils'

const FORBIDDEN_FIELD_PATTERN = /authorization|cookie|jwt|token|apikey|signature|signedurl|requestbody|responsebody/i
const SENSITIVE_CONFIG_FIELD_PATTERN = /password|secret|clientsecret|smtp(?:password|pass)/i
const SENSITIVE_VALUE_PATTERN = /^(?:bearer|basic)\s+|^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.|https?:\/\/\S*[?&](?:x-amz-signature|signature|token|expires|credential)=/i
const ALLOWED_CHANGE_FIELDS = new Set([
  'status',
  'previousStatus',
  'role',
  'previousRole',
  'enabled',
  'previousEnabled',
  'name',
  'previousName',
  'title',
  'previousTitle',
  'scheduleDate',
  'semester',
  'provider',
  'configKey',
  'changedFields',
  'count',
  'affectedCount',
  'ids',
  'filename',
  'mode',
  'reason',
  'permissions',
  'previousPermissions',
  'retentionDays',
  'autoBackupEnabled',
  'target',
  'operation',
  'source',
  'destination'
])

export interface AdminOperationActor {
  id: number
  role: string
}

export interface RecordAdminOperationInput {
  actor: AdminOperationActor
  action: string
  targetType: string
  targetId?: string | number | null
  targetLabel?: string | null
  result: 'SUCCESS' | 'FAILURE'
  summary: string
  failureCode?: string | null
  changes?: Record<string, unknown> | null
}

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  if (!normalized) return null
  if (SENSITIVE_VALUE_PATTERN.test(normalized)) return '已脱敏'

  return normalized.slice(0, maxLength)
}

function sanitizeChangeValue(value: unknown): string | number | boolean | null | Array<string | number | boolean> | undefined {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value

  if (typeof value === 'string') return sanitizeText(value, 160) ?? undefined

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, 50)
      .map((item) => {
        if (typeof item === 'string') return sanitizeText(item, 80)
        if (typeof item === 'number' || typeof item === 'boolean') return item
        return undefined
      })
      .filter((item): item is string | number | boolean => item !== undefined && item !== null)

    return sanitized
  }

  return undefined
}

/**
 * 仅保留明确允许的变更摘要；敏感配置字段只记录“已更新”。
 */
export function sanitizeAdminOperationChanges(changes: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(changes)) {
    if (FORBIDDEN_FIELD_PATTERN.test(key)) continue

    if (SENSITIVE_CONFIG_FIELD_PATTERN.test(key)) {
      sanitized[key] = '已更新'
      continue
    }

    if (!ALLOWED_CHANGE_FIELDS.has(key)) continue

    const sanitizedValue = sanitizeChangeValue(value)
    if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

/**
 * 写入管理操作审计日志。调用方必须传入已完成管理员认证的操作者信息。
 */
export async function recordAdminOperation(event: H3Event, input: RecordAdminOperationInput): Promise<void> {
  try {
    if (!Number.isInteger(input.actor?.id) || input.actor.id <= 0) {
      throw new Error('缺少有效的审计操作者 ID')
    }

    const action = sanitizeText(input.action, 100)
    const targetType = sanitizeText(input.targetType, 64)
    const summary = sanitizeText(input.summary, 1000) || '已执行管理操作'
    if (!action || !targetType || !['SUCCESS', 'FAILURE'].includes(input.result)) {
      throw new Error('缺少有效的审计动作或目标类型')
    }

    const requestId = sanitizeText(event.context.operationsMetricsRequestId, 128)
    await db.insert(adminOperationLogs).values({
      actorId: input.actor.id,
      actorRole: sanitizeText(input.actor.role, 32) || 'UNKNOWN',
      action,
      targetType,
      targetId: input.targetId == null ? null : String(input.targetId).slice(0, 500),
      targetLabel: sanitizeText(input.targetLabel, 255),
      result: input.result,
      summary,
      failureCode: sanitizeText(input.failureCode, 100),
      changes: sanitizeAdminOperationChanges(input.changes),
      ipAddress: getClientIP(event),
      userAgent: sanitizeText(getRequestHeader(event, 'user-agent'), 500),
      requestId
    })
  } catch (error) {
    // 审计写入失败不得影响已完成的业务操作。
    console.error('[AdminOperationAudit] 写入管理操作审计日志失败:', error)
  }
}
