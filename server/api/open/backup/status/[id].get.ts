import { defineEventHandler, getRouterParam } from 'h3'
import { eq, desc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { backupHistory } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

/** 60 秒超时阈值 */
const TIMEOUT_THRESHOLD_MS = 60_000

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')

  if (!idParam) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少备份 ID')
  }

  let record

  if (idParam === 'latest') {
    const [latest] = await db
      .select()
      .from(backupHistory)
      .orderBy(desc(backupHistory.createdAt))
      .limit(1)
    record = latest
  } else {
    const backupId = parseInt(idParam, 10)
    if (isNaN(backupId)) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的备份 ID')
    }
    const [found] = await db
      .select()
      .from(backupHistory)
      .where(eq(backupHistory.id, backupId))
    record = found
  }

  if (!record) {
    throw createApiError(404, 'BACKUP_NOT_FOUND', '备份记录不存在')
  }

  const methods: Array<{ method: string; success: boolean; error?: string | null }> = JSON.parse(record.methods)
  const allCompleted = methods.every(m => m.success || m.error != null)
  const age = Date.now() - new Date(record.createdAt).getTime()
  const completedCount = methods.filter(m => m.success || m.error != null).length
  const succeededCount = methods.filter(m => m.success).length
  const failedCount = methods.filter(m => m.error != null).length

  const status = allCompleted
    ? (succeededCount === methods.length ? 'completed' : failedCount === methods.length ? 'failed' : 'partial')
    : (age > TIMEOUT_THRESHOLD_MS ? 'timeout' : 'running')

  return {
    success: true,
    data: {
      id: record.id,
      filename: record.filename,
      status,
      totalRecords: record.totalRecords,
      backupSize: record.backupSize,
      createdAt: record.createdAt,
      progress: {
        total: methods.length,
        completed: completedCount,
        succeeded: succeededCount,
        failed: failedCount
      },
      methods
    }
  }
})