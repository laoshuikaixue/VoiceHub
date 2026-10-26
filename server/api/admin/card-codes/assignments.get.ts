import { db } from '~/drizzle/db'
import { cardCodeAssignments } from '~/drizzle/schema'
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { formatDateTime, getBeijingEndOfDay, getBeijingStartOfDay, parseToBeijingTime } from '~/utils/timeUtils'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'

/** 按用户、状态与北京日期查询派发记录。 */
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const query = getQuery(event)
  const parseDayBoundary = (value: unknown, field: string): Date | null => {
    if (value === undefined || value === '') return null
    const text = typeof value === 'string' ? value.trim() : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        `${field}必须为有效的 YYYY-MM-DD 格式`
      )
    }
    let parsed: Date
    try {
      parsed = parseToBeijingTime(text)
      if (Number.isNaN(parsed.getTime()) || formatDateTime(parsed, 'YYYY-MM-DD') !== text) {
        throw new RangeError('日期无效')
      }
    } catch {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        `${field}必须为有效的 YYYY-MM-DD 格式`
      )
    }
    return parsed
  }
  const fromDay = parseDayBoundary(query.startDate, '开始日期')
  const toDay = parseDayBoundary(query.endDate, '结束日期')
  if (fromDay && toDay && fromDay > toDay) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '开始日期不能晚于结束日期')
  }

  try {
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : ''
    const keyword = typeof query.q === 'string' ? query.q.trim() : ''
    const assigneeName = typeof query.assignee === 'string' ? query.assignee.trim() : ''
    const dispatcherName = typeof query.dispatcher === 'string' ? query.dispatcher.trim() : ''
    const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
    const limitInput = Number.parseInt(String(query.limit || '10'), 10) || 10
    const limit = Math.min(100, Math.max(1, limitInput))
    const offset = (page - 1) * limit

    const conditions = [] as any[]
    if (status && ['ASSIGNED', 'USED', 'RECYCLED', 'FAILED'].includes(status)) {
      conditions.push(eq(cardCodeAssignments.status, status as any))
    }
    if (keyword) {
      conditions.push(
        or(
          ilike(cardCodeAssignments.codeSnapshot, `%${keyword}%`),
          ilike(cardCodeAssignments.userNameSnapshot, `%${keyword}%`),
          ilike(cardCodeAssignments.assignedByName, `%${keyword}%`)
        )
      )
    }
    if (assigneeName) {
      conditions.push(ilike(cardCodeAssignments.userNameSnapshot, `%${assigneeName}%`))
    }
    if (dispatcherName) {
      conditions.push(ilike(cardCodeAssignments.assignedByName, `%${dispatcherName}%`))
    }
    if (fromDay) {
      conditions.push(gte(cardCodeAssignments.assignedAt, getBeijingStartOfDay(fromDay)))
    }
    if (toDay) {
      conditions.push(lte(cardCodeAssignments.assignedAt, getBeijingEndOfDay(toDay)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [result, totalResult, statsRows] = await Promise.all([
      db
        .select()
        .from(cardCodeAssignments)
        .where(whereClause)
        .orderBy(desc(cardCodeAssignments.assignedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(cardCodeAssignments).where(whereClause),
      db
        .select({ status: cardCodeAssignments.status, count: count() })
        .from(cardCodeAssignments)
        .groupBy(cardCodeAssignments.status)
    ])

    const stats = { total: 0, assigned: 0, used: 0, recycled: 0, failed: 0 }
    for (const row of statsRows) {
      const value = Number(row.count || 0)
      stats.total += value
      if (row.status === 'ASSIGNED') stats.assigned = value
      if (row.status === 'USED') stats.used = value
      if (row.status === 'RECYCLED') stats.recycled = value
      if (row.status === 'FAILED') stats.failed = value
    }

    const total = Number(totalResult[0]?.count || 0)
    return {
      success: true,
      data: result.map((row) => ({
        ...row,
        assignedAtDisplay: formatDateTime(row.assignedAt),
        usedAtDisplay: row.usedAt ? formatDateTime(row.usedAt) : null,
        recycledAtDisplay: row.recycledAt ? formatDateTime(row.recycledAt) : null,
        createdAtDisplay: formatDateTime(row.createdAt),
        updatedAtDisplay: formatDateTime(row.updatedAt)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      stats
    }
  } catch (err) {
    console.error('获取点歌券派发记录失败', err)
    throw createApiError(500, SERVER_ERROR_CODES.AUTH_SYSTEM_ERROR, '获取点歌券派发记录失败')
  }
})
