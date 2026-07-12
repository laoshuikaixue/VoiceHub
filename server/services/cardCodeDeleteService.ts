import { inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '~/drizzle/db'
import { cardCodes, songs } from '~/drizzle/schema'

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

    const referencedSongs = await tx
      .select({ id: songs.id })
      .from(songs)
      .where(inArray(songs.cardCodeId, existingIds))
      .limit(1)

    if (referencedSongs.length > 0) {
      throw createError({
        statusCode: 409,
        message: '已关联投稿的点歌券不能删除，请改为作废'
      })
    }

    return await tx.delete(cardCodes).where(inArray(cardCodes.id, existingIds)).returning()
  })
}
