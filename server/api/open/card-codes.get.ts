import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

const CARD_CODE_STATUSES = ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID'] as const

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey
  if (!apiKey) {
    throw createError({ statusCode: 401, message: 'API认证失败' })
  }

  try {
    const query = getQuery(event)
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : ''
    const keyword = typeof query.q === 'string' ? query.q.trim() : ''
    const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
    const limitInput = Number.parseInt(String(query.limit || '20'), 10) || 20
    const limit = Math.min(100, Math.max(1, limitInput))
    const offset = (page - 1) * limit

    if (status && !CARD_CODE_STATUSES.includes(status as any)) {
      throw createError({ statusCode: 400, message: '不支持的状态值' })
    }

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

    let queryBuilder = db.select().from(cardCodes)
    let countQueryBuilder = db.select({ count: count() }).from(cardCodes)
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions))
      countQueryBuilder = countQueryBuilder.where(and(...conditions))
    }

    const [items, totalResult, statsRows] = await Promise.all([
      queryBuilder.orderBy(desc(cardCodes.createdAt)).limit(limit).offset(offset),
      countQueryBuilder,
      db.select({ status: cardCodes.status, count: count() }).from(cardCodes).groupBy(cardCodes.status)
    ])

    const stats = { total: 0, available: 0, locked: 0, redeemed: 0, invalid: 0 }
    for (const row of statsRows) {
      const value = Number(row.count || 0)
      stats.total += value
      if (row.status === 'AVAILABLE') stats.available = value
      if (row.status === 'LOCKED') stats.locked = value
      if (row.status === 'REDEEMED') stats.redeemed = value
      if (row.status === 'INVALID') stats.invalid = value
    }

    const total = Number(totalResult[0]?.count || 0)
    return {
      success: true,
      data: {
        cardCodes: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        },
        stats,
        filters: {
          status: status || null,
          q: keyword || null
        }
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('开放API获取点歌券列表失败', err)
    throw createError({ statusCode: 500, message: '获取点歌券列表失败' })
  }
})
