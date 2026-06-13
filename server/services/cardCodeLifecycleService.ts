import { and, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { cardCodeRedeemLogs, cardCodes } from '~/drizzle/schema'

type CardCodeTransitionContext = {
  songId: number
  cardCodeId: number | null | undefined
  operatorId: number
  at?: Date
}

const getTransitionTime = (at?: Date) => at || new Date()

const readCardCode = async (tx: any, cardCodeId: number) => {
  const rows = await tx.select().from(cardCodes).where(eq(cardCodes.id, cardCodeId)).limit(1)
  return rows[0] || null
}

export const redeemCardCodeForSchedule = async (
  tx: any,
  { songId, cardCodeId, operatorId, at }: CardCodeTransitionContext
) => {
  if (!cardCodeId) return { changed: false, reason: 'NO_CARD_CODE' }

  const redeemedAt = getTransitionTime(at)
  const redeemResult = await tx
    .update(cardCodes)
    .set({
      status: 'REDEEMED',
      redeemedBy: operatorId,
      redeemedAt,
      lockedBy: null,
      lockedAt: null,
      updatedAt: redeemedAt
    })
    .where(and(eq(cardCodes.id, cardCodeId), inArray(cardCodes.status, ['AVAILABLE', 'LOCKED'])))
    .returning({ id: cardCodes.id, code: cardCodes.code, redeemedAt: cardCodes.redeemedAt })

  if (redeemResult.length > 0) {
    const redeemedCardCode = redeemResult[0]
    await tx.insert(cardCodeRedeemLogs).values({
      cardCodeId: redeemedCardCode.id,
      codeSnapshot: redeemedCardCode.code,
      redeemedBy: operatorId,
      redeemedAt: redeemedCardCode.redeemedAt || redeemedAt,
      source: 'SCHEDULE_AUTO',
      songId
    })
    return { changed: true, status: 'REDEEMED' }
  }

  const current = await readCardCode(tx, cardCodeId)
  if (!current) {
    throw createError({ statusCode: 400, message: '关联的点歌券不存在，无法发布排期' })
  }
  if (current.status === 'REDEEMED') {
    return { changed: false, status: 'REDEEMED' }
  }

  // 作废券继续排期会让财务/发放记录失真，因此这里让事务失败。
  throw createError({
    statusCode: 409,
    message: `点歌券当前状态为 ${current.status}，无法完成排期核销`
  })
}

export const restoreCardCodeAfterScheduleRemoval = async (
  tx: any,
  { songId, cardCodeId, operatorId, at }: CardCodeTransitionContext
) => {
  if (!cardCodeId) return { changed: false, reason: 'NO_CARD_CODE' }

  const restoredAt = getTransitionTime(at)
  const current = await readCardCode(tx, cardCodeId)
  if (!current) return { changed: false, reason: 'MISSING_CARD_CODE' }
  if (current.status !== 'REDEEMED') {
    return { changed: false, status: current.status }
  }

  const restoreResult = await tx
    .update(cardCodes)
    .set({
      status: 'LOCKED',
      lockedBy: current.lockedBy || operatorId,
      lockedAt: current.lockedAt || restoredAt,
      redeemedBy: null,
      redeemedAt: null,
      updatedAt: restoredAt
    })
    .where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, 'REDEEMED')))
    .returning({ id: cardCodes.id, code: cardCodes.code })

  if (restoreResult.length === 0) {
    return { changed: false, reason: 'CONCURRENT_CHANGE' }
  }

  await tx.insert(cardCodeRedeemLogs).values({
    cardCodeId,
    codeSnapshot: restoreResult[0].code,
    redeemedBy: operatorId,
    redeemedAt: restoredAt,
    source: 'SCHEDULE_REMOVE',
    songId
  })

  return { changed: true, status: 'LOCKED' }
}

export const releaseCardCodeAfterSongWithdrawal = async (
  tx: any,
  { songId, cardCodeId, operatorId, at }: CardCodeTransitionContext
) => {
  if (!cardCodeId) return { changed: false, reason: 'NO_CARD_CODE' }

  const releasedAt = getTransitionTime(at)
  const current = await readCardCode(tx, cardCodeId)
  if (!current) return { changed: false, reason: 'MISSING_CARD_CODE' }
  if (!['LOCKED', 'REDEEMED'].includes(current.status)) {
    return { changed: false, status: current.status }
  }

  const releaseResult = await tx
    .update(cardCodes)
    .set({
      status: 'AVAILABLE',
      lockedBy: null,
      lockedAt: null,
      redeemedBy: null,
      redeemedAt: null,
      updatedAt: releasedAt
    })
    .where(and(eq(cardCodes.id, cardCodeId), inArray(cardCodes.status, ['LOCKED', 'REDEEMED'])))
    .returning({ id: cardCodes.id, code: cardCodes.code })

  if (releaseResult.length === 0) {
    return { changed: false, reason: 'CONCURRENT_CHANGE' }
  }

  await tx.insert(cardCodeRedeemLogs).values({
    cardCodeId,
    codeSnapshot: releaseResult[0].code,
    redeemedBy: operatorId,
    redeemedAt: releasedAt,
    source: 'WITHDRAW',
    songId
  })

  return { changed: true, status: 'AVAILABLE' }
}
