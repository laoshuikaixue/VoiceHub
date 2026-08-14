import { inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'

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

    return await tx.delete(cardCodes).where(inArray(cardCodes.id, existingIds)).returning()
  })
}