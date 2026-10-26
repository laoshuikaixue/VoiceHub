import { db } from '~/drizzle/db'
import { cardCodeAssignments } from '~/drizzle/schema'
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { getBeijingEndOfDay, getBeijingStartOfDay, parseToBeijingTime } from '~/utils/timeUtils'

/**
 * 派发记录查询：支持按状态、接收人、派发人、关键词与时间范围筛选。
 * 返回派发时间、派发人员、接收人、通知状态与失败原因，供管理员追溯。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  try {
    const query = getQuery(event)
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : ''
    const keyword = typeof query.q === 'string' ? query.q.trim() : ''
    const assigneeName = typeof query.assignee === 'string' ? query.assignee.trim() : ''
    const dispatcherName = typeof query.dispatcher === 'string' ? query.dispatcher.trim() : ''
    const startDate = typeof query.startDate === 'string' ? query.startDate.trim() : ''
    const endDate = typeof query.endDate === 'string' ? query.endDate.trim() : ''
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
    if (startDate) {
      // 日期筛选按北京当天的起止边界，不能拿服务端本地时区划天
      const from = parseToBeijingTime(startDate)
      if (!Number.isNaN(from.getTime())) {
        conditions.push(gte(cardCodeAssignments.assignedAt, getBeijingStartOfDay(from)))
      }
    }
    if (endDate) {
      const to = parseToBeijingTime(endDate)
      if (!Number.isNaN(to.getTime())) {
        conditions.push(lte(cardCodeAssignments.assignedAt, getBeijingEndOfDay(to)))
      }
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
      data: result,
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
    throw createError({ statusCode: 500, message: '获取点歌券派发记录失败' })
  }
})
