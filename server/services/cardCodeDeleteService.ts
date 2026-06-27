import { inArray } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'

export const deleteCardCodesByIds = async (ids: number[]) => {
  const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
  if (!normalizedIds.length) {
    return []
  }

  return await db
    .delete(cardCodes)
    .where(inArray(cardCodes.id, normalizedIds))
    .returning()
}
