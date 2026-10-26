import { and, desc, eq, inArray } from 'drizzle-orm'
import { cardCodeRedeemLogs, cardCodes, schedules, songs } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { markCardCodeAssignmentUsed, restoreCardCodeAssignment } from './cardCodeAssignmentService'

type CardCodeTransitionContext = {
  songId: number
  cardCodeId: number | null | undefined
  operatorId: number
  at?: Date
  cancelPlayback?: boolean
  removeSong?: boolean
}

const conflict = () => createApiError(
  409, SERVER_ERROR_CODES.CARD_CODE_LOCKED_OR_UNAVAILABLE, '点歌券关联或状态已变化，请刷新后重试'
)

const readBinding = async (tx: any, songId: number, cardCodeId: number) => {
  const [song] = await tx.select().from(songs).where(eq(songs.id, songId)).limit(1).for('update')
  if (!song || song.cardCodeId !== cardCodeId) throw conflict()
  const [card] = await tx.select().from(cardCodes).where(eq(cardCodes.id, cardCodeId)).limit(1).for('update')
  if (!card) throw conflict()
  const bindings = await tx.select({ id: songs.id }).from(songs).where(eq(songs.cardCodeId, cardCodeId))
  if (bindings.length !== 1 || bindings[0].id !== songId) throw conflict()
  return { song, card }
}

const readPublished = (tx: any, songId: number) => tx.select({ played: schedules.played })
  .from(schedules).where(and(eq(schedules.songId, songId), eq(schedules.isDraft, false)))

const writeLog = (tx: any, card: any, songId: number, operatorId: number, at: Date, source: string) =>
  tx.insert(cardCodeRedeemLogs).values({
    cardCodeId: card.id, codeSnapshot: card.code, redeemedBy: operatorId,
    redeemedAt: at, source, songId
  })

const readRedemption = async (tx: any, cardCodeId: number, songId: number) => {
  const [log] = await tx.select().from(cardCodeRedeemLogs).where(and(
    eq(cardCodeRedeemLogs.cardCodeId, cardCodeId), eq(cardCodeRedeemLogs.songId, songId),
    inArray(cardCodeRedeemLogs.source, ['SCHEDULE_AUTO', 'SONG_PLAYED'])
  )).orderBy(desc(cardCodeRedeemLogs.id)).limit(1)
  if (!log) throw conflict()
  return log
}

/** 正式排期且已播放时核销，同一投稿只核销一次。 */
export const redeemCardCodeForSchedule = async (
  tx: any, { songId, cardCodeId, operatorId, at }: CardCodeTransitionContext
) => {
  if (!cardCodeId) return { changed: false, reason: 'NO_CARD_CODE' }
  const { song, card } = await readBinding(tx, songId, cardCodeId)
  const published = await readPublished(tx, songId)
  if (!published.length || (!song.played && !published.some((row: any) => row.played))) {
    if (card.status === 'REDEEMED' && !song.played) {
      return restoreCardCodeAfterScheduleRemoval(tx, { songId, cardCodeId, operatorId, at })
    }
    if (card.status !== 'LOCKED' && card.status !== 'REDEEMED') throw conflict()
    return { changed: false, status: card.status, reason: 'AWAITING_PLAYBACK' }
  }
  if (card.status === 'REDEEMED') {
    const logs = await tx.select({ id: cardCodeRedeemLogs.id }).from(cardCodeRedeemLogs).where(and(
      eq(cardCodeRedeemLogs.cardCodeId, cardCodeId), eq(cardCodeRedeemLogs.songId, songId),
      inArray(cardCodeRedeemLogs.source, ['SCHEDULE_AUTO', 'SONG_PLAYED'])
    )).limit(1)
    if (!logs.length) throw conflict()
    return { changed: false, status: 'REDEEMED' }
  }
  if (card.status !== 'LOCKED') throw conflict()
  const now = at || getServerDate()
  const updated = await tx.update(cardCodes).set({
    status: 'REDEEMED', redeemedBy: operatorId, redeemedAt: now,
    lockedBy: null, lockedAt: null, updatedAt: now
  }).where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, 'LOCKED'))).returning({ id: cardCodes.id })
  if (updated.length !== 1) throw conflict()
  await writeLog(tx, card, songId, operatorId, now, 'SONG_PLAYED')
  await markCardCodeAssignmentUsed(tx, cardCodeId, now)
  return { changed: true, status: 'REDEEMED' }
}

/** 未播放投稿保留锁券；撤销播放标记时回退核销。 */
export const restoreCardCodeAfterScheduleRemoval = async (
  tx: any, { songId, cardCodeId, operatorId, at, cancelPlayback }: CardCodeTransitionContext
) => {
  if (!cardCodeId) return { changed: false, reason: 'NO_CARD_CODE' }
  const { song, card } = await readBinding(tx, songId, cardCodeId)
  const published = await readPublished(tx, songId)
  const hasPlayed = song.played || published.some((row: any) => row.played)
  if (hasPlayed) {
    if (published.length && card.status === 'LOCKED') {
      return redeemCardCodeForSchedule(tx, { songId, cardCodeId, operatorId, at })
    }
    return { changed: false, status: card.status, reason: 'ALREADY_PLAYED' }
  }
  if (card.status === 'LOCKED') return { changed: false, status: 'LOCKED' }
  if (card.status === 'REDEEMED') {
    const log = await readRedemption(tx, cardCodeId, songId)
    if (!cancelPlayback && log.source === 'SONG_PLAYED') {
      return { changed: false, status: 'REDEEMED', reason: 'ALREADY_PLAYED' }
    }
  }
  if (!['REDEEMED', 'ASSIGNED', 'AVAILABLE'].includes(card.status)) throw conflict()
  if (card.assignedTo != null && card.assignedTo !== song.requesterId) throw conflict()
  const now = at || getServerDate()
  const updated = await tx.update(cardCodes).set({
    status: 'LOCKED', lockedBy: song.requesterId, lockedAt: card.lockedAt || now,
    redeemedBy: null, redeemedAt: null, updatedAt: now
  }).where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, card.status))).returning({ id: cardCodes.id })
  if (updated.length !== 1) throw conflict()
  if (card.status === 'REDEEMED') await writeLog(tx, card, songId, operatorId, now, 'PLAYBACK_CANCEL')
  if (card.assignedTo != null) await restoreCardCodeAssignment(tx, cardCodeId, now)
  return { changed: true, status: 'LOCKED' }
}

/** 撤回未播放投稿时解绑并归还；已播放投稿保留核销。 */
export const releaseCardCodeAfterSongWithdrawal = async (
  tx: any, { songId, cardCodeId, operatorId, at, removeSong }: CardCodeTransitionContext
) => {
  if (!cardCodeId) return { changed: false, reason: 'NO_CARD_CODE' }
  const { song, card } = await readBinding(tx, songId, cardCodeId)
  const published = await readPublished(tx, songId)
  const played = song.played || published.some((row: any) => row.played)
  if (played && !removeSong) throw createApiError(
    409, SERVER_ERROR_CODES.SONG_PLAYED_CANNOT_WITHDRAW, '已播放歌曲不能撤回'
  )
  if (played && published.length && card.status === 'LOCKED') {
    return redeemCardCodeForSchedule(tx, { songId, cardCodeId, operatorId, at })
  }
  if (published.length && !removeSong) throw createApiError(
    409, SERVER_ERROR_CODES.SONG_SCHEDULED_CANNOT_WITHDRAW, '已发布的投稿不能归还点歌券'
  )
  if (!['LOCKED', 'REDEEMED'].includes(card.status)) throw conflict()
  if (card.status === 'REDEEMED') {
    const log = await readRedemption(tx, cardCodeId, songId)
    if (played || log.source === 'SONG_PLAYED') {
      if (!removeSong) throw createApiError(409, SERVER_ERROR_CODES.SONG_PLAYED_CANNOT_WITHDRAW, '已播放歌曲不能撤回')
      return { changed: false, status: 'REDEEMED', reason: 'ALREADY_PLAYED' }
    }
  }
  const now = at || getServerDate()
  const status = card.assignedTo != null ? 'ASSIGNED' : 'AVAILABLE'
  const updated = await tx.update(cardCodes).set({
    status, lockedBy: null, lockedAt: null, redeemedBy: null, redeemedAt: null, updatedAt: now
  }).where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, card.status))).returning({ id: cardCodes.id })
  if (updated.length !== 1) throw conflict()
  const detached = await tx.update(songs).set({ cardCodeId: null, updatedAt: now })
    .where(and(eq(songs.id, songId), eq(songs.cardCodeId, cardCodeId))).returning({ id: songs.id })
  if (detached.length !== 1) throw conflict()
  await writeLog(tx, card, songId, operatorId, now, 'WITHDRAW')
  if (card.assignedTo != null) await restoreCardCodeAssignment(tx, cardCodeId, now)
  return { changed: true, status }
}
