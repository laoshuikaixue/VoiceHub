import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { schedules } from '~/drizzle/schema'
import { and, eq, gte, lt } from 'drizzle-orm'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 回滚辅助接口：删除指定日期的全部排期（仅用于复制失败回滚）
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const body = await readBody(event)
  const dateStr = typeof body?.date === 'string' ? body.date.trim() : ''
  if (!dateStr) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少日期参数')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '日期无效')
  }

  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`)

  const deleted = await db
    .delete(schedules)
    .where(and(gte(schedules.playDate, startOfDay), lt(schedules.playDate, endOfDay)))
    .returning({ id: schedules.id })

  return { success: true, removed: deleted.length }
})
