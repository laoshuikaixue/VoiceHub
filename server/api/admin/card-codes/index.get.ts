import { getQuery } from 'h3'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { requireCardCodeAdministrator } from './_shared'

export default defineEventHandler(async (event) => {
  requireCardCodeAdministrator(event)

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

  let queryBuilder = db.select().from(cardCodes)
  let countQueryBuilder = db.select({ count: count() }).from(cardCodes)
  if (conditions.length > 0) {
    queryBuilder = queryBuilder.where(and(...conditions))
    countQueryBuilder = countQueryBuilder.where(and(...conditions))
  }

  const [result, totalResult, statsRows] = await Promise.all([
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
    data: result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    },
    stats
  }
})