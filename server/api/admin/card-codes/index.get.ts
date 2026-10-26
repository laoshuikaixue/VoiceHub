import { db } from '~/drizzle/db'
import { cardCodes, users } from '~/drizzle/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

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
    const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
    const limitInput = Number.parseInt(String(query.limit || '10'), 10) || 10
    const limit = Math.min(100, Math.max(1, limitInput))
    const offset = (page - 1) * limit

    const conditions = [] as any[]
    if (status) {
      conditions.push(eq(cardCodes.status, status as any))
    }
    if (keyword) {
      conditions.push(
        or(
          ilike(cardCodes.code, `%${keyword}%`),
          ilike(cardCodes.note, `%${keyword}%`)
        )
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [result, totalResult, statsRows] = await Promise.all([
      db
        .select({
          id: cardCodes.id,
          code: cardCodes.code,
          status: cardCodes.status,
          note: cardCodes.note,
          createdAt: cardCodes.createdAt,
          updatedAt: cardCodes.updatedAt,
          lockedBy: cardCodes.lockedBy,
          lockedAt: cardCodes.lockedAt,
          redeemedBy: cardCodes.redeemedBy,
          redeemedAt: cardCodes.redeemedAt,
          assignedTo: cardCodes.assignedTo,
          assignedAt: cardCodes.assignedAt,
          // 持有人展示名，便于管理员识别券的归属
          assigneeName: users.name,
          assigneeUsername: users.username
        })
        .from(cardCodes)
        .leftJoin(users, eq(cardCodes.assignedTo, users.id))
        .where(whereClause)
        .orderBy(desc(cardCodes.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(cardCodes).where(whereClause),
      db.select({ status: cardCodes.status, count: count() }).from(cardCodes).groupBy(cardCodes.status)
    ])

    const stats = { total: 0, available: 0, assigned: 0, locked: 0, redeemed: 0 }
    for (const row of statsRows) {
      const value = Number(row.count || 0)
      stats.total += value
      if (row.status === 'AVAILABLE') stats.available = value
      if (row.status === 'ASSIGNED') stats.assigned = value
      if (row.status === 'LOCKED') stats.locked = value
      if (row.status === 'REDEEMED') stats.redeemed = value
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
    console.error('获取点歌券列表失败', err)
    throw createError({ statusCode: 500, message: '获取点歌券列表失败' })
  }
})
