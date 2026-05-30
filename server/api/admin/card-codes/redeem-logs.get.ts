import { db } from '~/drizzle/db'
import { cardCodeRedeemLogs, cardCodes, songs, users } from '~/drizzle/schema'
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'

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
    const limitParam = Number(query.limit)
    const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50

    const keyword = typeof query.q === 'string' ? query.q.trim() : ''
    const source = typeof query.source === 'string' ? query.source.trim().toUpperCase() : ''
    const redeemer = typeof query.redeemer === 'string' ? query.redeemer.trim() : ''
    const cardCode = typeof query.cardCode === 'string' ? query.cardCode.trim() : ''
    const songKeyword = typeof query.song === 'string' ? query.song.trim() : ''
    const startDate = typeof query.startDate === 'string' ? query.startDate.trim() : ''
    const endDate = typeof query.endDate === 'string' ? query.endDate.trim() : ''

    const conditions: any[] = []

    if (source) {
      conditions.push(eq(cardCodeRedeemLogs.source, source as any))
    }

    if (cardCode) {
      conditions.push(or(ilike(cardCodes.code, `%${cardCode}%`), ilike(cardCodeRedeemLogs.codeSnapshot, `%${cardCode}%`)))
    }

    if (redeemer) {
      conditions.push(or(ilike(users.name, `%${redeemer}%`), ilike(users.username, `%${redeemer}%`)))
    }

    if (songKeyword) {
      conditions.push(or(ilike(songs.title, `%${songKeyword}%`), ilike(songs.artist, `%${songKeyword}%`)))
    }

    if (keyword) {
      conditions.push(
        or(
          ilike(cardCodes.code, `%${keyword}%`),
          ilike(cardCodeRedeemLogs.codeSnapshot, `%${keyword}%`),
          ilike(users.name, `%${keyword}%`),
          ilike(users.username, `%${keyword}%`),
          ilike(songs.title, `%${keyword}%`),
          ilike(songs.artist, `%${keyword}%`),
          ilike(cardCodeRedeemLogs.source, `%${keyword}%`)
        )
      )
    }

    const startDateValue = startDate ? new Date(startDate) : null
    if (startDateValue && !Number.isNaN(startDateValue.getTime())) {
      conditions.push(gte(cardCodeRedeemLogs.redeemedAt, startDateValue))
    }

    const endDateValue = endDate ? new Date(endDate) : null
    if (endDateValue && !Number.isNaN(endDateValue.getTime())) {
      const adjustedEndDate = new Date(endDateValue)
      adjustedEndDate.setHours(23, 59, 59, 999)
      conditions.push(lte(cardCodeRedeemLogs.redeemedAt, adjustedEndDate))
    }

    let queryBuilder = db
      .select({
        id: cardCodeRedeemLogs.id,
        cardCodeId: cardCodeRedeemLogs.cardCodeId,
        codeSnapshot: cardCodeRedeemLogs.codeSnapshot,
        redeemedAt: cardCodeRedeemLogs.redeemedAt,
        source: cardCodeRedeemLogs.source,
        songId: cardCodeRedeemLogs.songId,
        currentCode: cardCodes.code,
        songTitle: songs.title,
        songArtist: songs.artist,
        redeemerId: users.id,
        redeemerName: users.name,
        redeemerUsername: users.username
      })
      .from(cardCodeRedeemLogs)
      .leftJoin(users, eq(cardCodeRedeemLogs.redeemedBy, users.id))
      .leftJoin(cardCodes, eq(cardCodeRedeemLogs.cardCodeId, cardCodes.id))
      .leftJoin(songs, eq(cardCodeRedeemLogs.songId, songs.id))
      
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions))
    }

    const result = await queryBuilder
      .orderBy(desc(cardCodeRedeemLogs.redeemedAt), desc(cardCodeRedeemLogs.id))
      .limit(limit)

    return {
      success: true,
      data: result.map((item) => ({
        id: item.id,
        cardCodeId: item.cardCodeId,
        code: item.currentCode || item.codeSnapshot,
        codeSnapshot: item.codeSnapshot,
        redeemedAt: item.redeemedAt,
        source: item.source,
        song: item.songId
          ? {
              id: item.songId,
              title: item.songTitle || '未知歌曲',
              artist: item.songArtist || ''
            }
          : null,
        redeemer: {
          id: item.redeemerId,
          name: item.redeemerName || '未知用户',
          username: item.redeemerUsername || 'unknown'
        }
      }))
    }
  } catch (err) {
    console.error('获取点歌券兑换日志失败', err)
    throw createError({ statusCode: 500, message: '获取点歌券兑换日志失败' })
  }
})
