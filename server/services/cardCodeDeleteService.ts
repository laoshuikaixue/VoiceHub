import { and, eq, inArray } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { db } from '~/drizzle/db'
import { cardCodes, songs, users } from '~/drizzle/schema'

export const deleteCardCodesByIds = async (ids: number[]) => {
  const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
  if (!normalizedIds.length) {
    return []
  }

  return await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({ id: cardCodes.id })
      .from(cardCodes)
      .where(inArray(cardCodes.id, normalizedIds))
      .for('update')

    const existingIds = existingRows.map((row) => row.id)
    if (!existingIds.length) {
      return []
    }

    // 已派发给用户的券是用户手上的有价物，删除前必须先回收（回收会把券退回可用池并通知持有人）
    const assignedRows = await tx
      .select({
        id: cardCodes.id,
        code: cardCodes.code,
        holderName: users.name,
        holderUsername: users.username
      })
      .from(cardCodes)
      .leftJoin(users, eq(users.id, cardCodes.assignedTo))
      .where(and(inArray(cardCodes.id, existingIds), eq(cardCodes.status, 'ASSIGNED')))

    if (assignedRows.length > 0) {
      const listed = assignedRows
        .slice(0, 10)
        .map((row) => `${row.code}（${row.holderName || row.holderUsername || '未知持有人'}）`)
        .join('、')
      const suffix = assignedRows.length > 10 ? ` 等 ${assignedRows.length} 张` : ''
      throw createApiError(409, SERVER_ERROR_CODES.CARD_CODE_NOT_ASSIGNABLE,
        `已派发给用户的点歌券不能删除，请先在「派发记录」中回收：${listed}${suffix}`,
        { assignedCardCodeIds: assignedRows.map((row) => row.id) })
    }

    const referencedSongs = await tx
      .select({ id: songs.id })
      .from(songs)
      .where(inArray(songs.cardCodeId, existingIds))
      .limit(1)

    if (referencedSongs.length > 0) {
      throw createApiError(409, SERVER_ERROR_CODES.CARD_CODE_BOUND_TO_SONG, '已关联投稿的点歌券不能删除，请改为作废')
    }

    return await tx.delete(cardCodes).where(inArray(cardCodes.id, existingIds)).returning()
  })
}
