import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db, users, voucherCodes } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '仅管理员可查看点歌券'
    })
  }

  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '20'), 10) || 20))
  const status = String(query.status || 'ALL').toUpperCase()
  const search = String(query.search || '').trim()
  const offset = (page - 1) * limit

  const whereConditions = []

  if (['ACTIVE', 'USED', 'DISABLED', 'EXPIRED'].includes(status)) {
    whereConditions.push(eq(voucherCodes.status, status as any))
  }

  if (search) {
    whereConditions.push(
      sql`(
        ${voucherCodes.codeTail} ILIKE ${`%${search}%`}
        OR ${users.name} ILIKE ${`%${search}%`}
        OR ${users.username} ILIKE ${`%${search}%`}
      )`
    )
  }

  const whereClause =
    whereConditions.length === 0
      ? undefined
      : whereConditions.length === 1
        ? whereConditions[0]
        : and(...whereConditions)

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: voucherCodes.id,
        codeTail: voucherCodes.codeTail,
        status: voucherCodes.status,
        usedByUserId: voucherCodes.usedByUserId,
        usedAt: voucherCodes.usedAt,
        usedTaskId: voucherCodes.usedTaskId,
        createdAt: voucherCodes.createdAt,
        updatedAt: voucherCodes.updatedAt,
        usedByName: users.name,
        usedByUsername: users.username
      })
      .from(voucherCodes)
      .leftJoin(users, eq(voucherCodes.usedByUserId, users.id))
      .where(whereClause)
      .orderBy(desc(voucherCodes.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(voucherCodes)
      .leftJoin(users, eq(voucherCodes.usedByUserId, users.id))
      .where(whereClause)
  ])

  const total = totalResult[0]?.total || 0

  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    }
  }
})
