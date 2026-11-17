import { createError, defineEventHandler, getQuery } from 'h3'
import { and, desc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { adminAuditLogs } from '~/drizzle/schema'
import { formatDateTime, getBeijingTime } from '~/utils/timeUtils'
import { buildAuditLogConditions } from '~~/server/utils/log-query'
import {
  buildCsv,
  buildJsonLines,
  readExportFormat,
  setLogDownloadHeaders
} from '~~/server/utils/log-export'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

const EXPORT_LIMIT = 20000

const CSV_HEADER = [
  '时间',
  '动作',
  '操作者 ID',
  '操作者',
  '目标类型',
  '目标 ID',
  '摘要',
  '结果',
  'IP',
  'User-Agent'
]

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const format = readExportFormat(query.format)
    const conditions = buildAuditLogConditions(query)
    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(EXPORT_LIMIT)

    const payload = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      createdAtDisplay: formatDateTime(row.createdAt)
    }))

    const stamp = formatDateTime(getBeijingTime(), 'YYYYMMDD-HHmmss')
    const filename = `voicehub-audit-logs-${stamp}.${format === 'jsonl' ? 'log' : 'csv'}`
    setLogDownloadHeaders(event, format, filename)

    await recordAdminAudit(event, 'logs.export', {
      targetType: 'log',
      targetId: 'audit',
      summary: {
        format,
        rows: payload.length,
        needsNarrowing: rows.length >= EXPORT_LIMIT,
        filters: query
      }
    })

    if (format === 'jsonl') return buildJsonLines(payload)

    return buildCsv(
      CSV_HEADER,
      payload.map((row) => [
        row.createdAtDisplay,
        row.action,
        row.actorId,
        row.actorName,
        row.targetType,
        row.targetId,
        row.summary,
        row.result,
        row.ipAddress,
        row.userAgent
      ])
    )
  } catch (error: any) {
    console.error('导出管理员审计日志失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '导出管理员审计日志失败' })
  }
})
