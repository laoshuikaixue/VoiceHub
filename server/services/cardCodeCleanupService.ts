import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodes, systemSettings } from '~/drizzle/schema'

export const CARD_CODE_AUTO_DELETE_DISABLED = 0
export const CARD_CODE_AUTO_DELETE_MAX_DAYS = 3650

export const normalizeCardCodeAutoDeleteDays = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(numericValue) || numericValue < CARD_CODE_AUTO_DELETE_DISABLED) {
    return CARD_CODE_AUTO_DELETE_DISABLED
  }
  return Math.min(numericValue, CARD_CODE_AUTO_DELETE_MAX_DAYS)
}

const getCardCodeAutoDeleteDays = async () => {
  const settingsRows = await db
    .select({ cardCodeAutoDeleteDays: systemSettings.cardCodeAutoDeleteDays })
    .from(systemSettings)
    .limit(1)
  return normalizeCardCodeAutoDeleteDays(settingsRows[0]?.cardCodeAutoDeleteDays ?? CARD_CODE_AUTO_DELETE_DISABLED)
}

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

export const cleanupExpiredCardCodes = async (options: { days?: number; now?: Date } = {}) => {
  const days = options.days !== undefined
    ? normalizeCardCodeAutoDeleteDays(options.days)
    : await getCardCodeAutoDeleteDays()

  if (days <= CARD_CODE_AUTO_DELETE_DISABLED) {
    return { deleted: 0, days, cutoff: null }
  }

  const now = options.now || new Date()
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const cutoffValue = cutoff.toISOString()

  const deletedRows = await db
    .delete(cardCodes)
    .where(
      or(
        and(eq(cardCodes.status, 'INVALID'), sql`${cardCodes.updatedAt} AT TIME ZONE 'UTC' < ${cutoffValue}::timestamptz`),
        and(eq(cardCodes.status, 'REDEEMED'), sql`coalesce(${cardCodes.redeemedAt}, ${cardCodes.updatedAt}) AT TIME ZONE 'UTC' < ${cutoffValue}::timestamptz`)
      )
    )
    .returning({ id: cardCodes.id })

  return { deleted: deletedRows.length, days, cutoff }
}
