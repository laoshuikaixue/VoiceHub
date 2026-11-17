import { createError, defineEventHandler, readBody } from 'h3'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import { recordAdminAudit } from '~~/server/utils/admin-audit'
import { cleanupApiLogs, cleanupAuditLogs, getLogSettings } from '~~/server/utils/log-retention'
import { parseLogCleanupType, type LogCleanupType } from '~~/server/utils/log-settings'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Record<string, unknown> | null>(event)
    // 缺省只清 API 访问日志；审计日志必须显式指定 type=audit 才会清理，避免顺手抹掉追责记录
    const type: LogCleanupType | null =
      body?.type === undefined || body?.type === null ? 'api' : parseLogCleanupType(body.type)
    if (!type) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '清理类型无效')
    }
    if (type === 'all') {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '不支持同时清理两类日志')
    }
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
