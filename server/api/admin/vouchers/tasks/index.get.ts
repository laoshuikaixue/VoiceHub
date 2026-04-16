import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db, songs, users, voucherCodes, voucherRedeemTasks } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '仅管理员可查看点歌券任务'
    })
  }

  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '20'), 10) || 20))
  const status = String(query.status || 'ALL').toUpperCase()
  const search = String(query.search || '').trim()
  const offset = (page - 1) * limit

  const whereConditions = []

  if (['PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED'].includes(status)) {
    whereConditions.push(eq(voucherRedeemTasks.status, status as any))
  }

  if (search) {
    whereConditions.push(
      sql`(
        ${songs.title} ILIKE ${`%${search}%`}
        OR ${songs.artist} ILIKE ${`%${search}%`}
        OR ${users.name} ILIKE ${`%${search}%`}
        OR ${users.username} ILIKE ${`%${search}%`}
        OR ${voucherCodes.codeTail} ILIKE ${`%${search}%`}
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
        id: voucherRedeemTasks.id,
        status: voucherRedeemTasks.status,
        redeemDeadlineAt: voucherRedeemTasks.redeemDeadlineAt,
        remindSentAt: voucherRedeemTasks.remindSentAt,
        redeemedAt: voucherRedeemTasks.redeemedAt,
        createdAt: voucherRedeemTasks.createdAt,
        updatedAt: voucherRedeemTasks.updatedAt,
        userId: users.id,
        username: users.username,
        userName: users.name,
        songId: songs.id,
        songTitle: songs.title,
        songArtist: songs.artist,
        voucherCodeTail: voucherCodes.codeTail
      })
      .from(voucherRedeemTasks)
      .innerJoin(users, eq(voucherRedeemTasks.userId, users.id))
      .innerJoin(songs, eq(voucherRedeemTasks.songId, songs.id))
      .leftJoin(voucherCodes, eq(voucherRedeemTasks.voucherCodeId, voucherCodes.id))
      .where(whereClause)
      .orderBy(desc(voucherRedeemTasks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(voucherRedeemTasks)
      .innerJoin(users, eq(voucherRedeemTasks.userId, users.id))
      .innerJoin(songs, eq(voucherRedeemTasks.songId, songs.id))
      .leftJoin(voucherCodes, eq(voucherRedeemTasks.voucherCodeId, voucherCodes.id))
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
