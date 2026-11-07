import { createError, defineEventHandler, readBody } from 'h3'
import { recordAdminAudit } from '~~/server/utils/admin-audit'
import { cleanupApiLogs, cleanupAuditLogs, getLogSettings } from '~~/server/utils/log-retention'

const CLEANUP_TYPES = ['api', 'audit', 'all'] as const
type CleanupType = (typeof CLEANUP_TYPES)[number]

function readCleanupType(value: unknown): CleanupType {
  return (CLEANUP_TYPES as readonly unknown[]).includes(value) ? (value as CleanupType) : 'all'
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Record<string, unknown> | null>(event)
    const type = readCleanupType(body?.type)
    const settings = await getLogSettings()

    // 保留天数由配置决定，不接受客户端指定，避免绕过保留策略一次性清空
    const apiDeleted = type === 'audit' ? 0 : await cleanupApiLogs(settings.apiLogRetentionDays)
    const auditDeleted = type === 'api' ? 0 : await cleanupAuditLogs(settings.auditLogRetentionDays)

    await recordAdminAudit(event, 'logs.cleanup', {
      targetType: 'log',
      targetId: type,
      summary: {
        apiDeleted,
        auditDeleted,
        apiLogRetentionDays: settings.apiLogRetentionDays,
        auditLogRetentionDays: settings.auditLogRetentionDays
      }
    })

    return {
      success: true,
      type,
      apiDeleted,
      auditDeleted,
      apiLogRetentionDays: settings.apiLogRetentionDays,
      auditLogRetentionDays: settings.auditLogRetentionDays
    }
  } catch (error: any) {
    console.error('清理日志失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '清理日志失败' })
  }
})
