import { and, asc, eq, inArray, or, sql } from 'drizzle-orm'
import { schedules, songReplayRequests, songs } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

interface ReplayBindingItem {
  songId: number
  replayRequestId?: number | null
}

interface ReplayBindingRow {
  id: number
  songId: number
  status: string
}

export function parseScheduleReplayRequestId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.SONG_REPLAY_INVALID_REQUEST, '重播申请无效或已被处理')
  }
  return id
}

/** rows 按创建时间和 ID 升序排列。 */
export function selectScheduleReplayBindings<T extends ReplayBindingItem>(
  items: T[],
  rows: ReplayBindingRow[],
  existingBindings: Map<number, number> = new Map()
): Array<T & { replayRequestId: number | null }> {
  const requests = new Map(rows.map((row) => [row.id, row]))
  const firstPending = new Map<number, number>()
  for (const row of rows) {
    if (row.status === 'PENDING' && !firstPending.has(row.songId)) {
      firstPending.set(row.songId, row.id)
    }
  }
  return items.map((item) => {
    const previousId = existingBindings.get(item.songId)
    const requestId = item.replayRequestId ?? firstPending.get(item.songId) ?? previousId ?? null
    if (requestId !== null) {
      const request = requests.get(requestId)
      if (
        !request || request.songId !== item.songId ||
        (request.status !== 'PENDING' && !(request.status === 'FULFILLED' && previousId === requestId))
      ) {
        throw createApiError(400, SERVER_ERROR_CODES.SONG_REPLAY_INVALID_REQUEST, '重播申请无效或已被处理')
      }
    }
    return { ...item, replayRequestId: requestId }
  })
}

export async function resolveScheduleReplayBindings<T extends ReplayBindingItem>(
  tx: any,
  items: T[],
  existingBindings: Map<number, number> = new Map()
): Promise<Array<T & { replayRequestId: number | null }>> {
  if (items.length === 0) return []
  const songIds = [...new Set(items.map((item) => item.songId))]
  await tx.select({ id: songs.id }).from(songs).where(inArray(songs.id, songIds)).orderBy(asc(songs.id)).for('update')
  const requestIds = [...new Set([
    ...items.map((item) => item.replayRequestId),
    ...existingBindings.values()
  ].filter((id): id is number => typeof id === 'number' && id > 0))]
  const pendingCondition = and(inArray(songReplayRequests.songId, songIds), eq(songReplayRequests.status, 'PENDING'))
  const rows = await tx.select({
    id: songReplayRequests.id,
    songId: songReplayRequests.songId,
    status: songReplayRequests.status
  }).from(songReplayRequests)
    .where(requestIds.length ? or(pendingCondition, inArray(songReplayRequests.id, requestIds)) : pendingCondition)
    .orderBy(asc(songReplayRequests.createdAt), asc(songReplayRequests.id))
    .for('update')
  return selectScheduleReplayBindings(items, rows, existingBindings)
}

interface FulfillReplayRequestsParams {
  tx: any
  songId: number
  scheduleId: number
  at: Date
  /** 已在当前事务内验证的最终绑定；传入后禁止重新选择申请。 */
  resolvedRequestId: number | null
}

interface FulfilledReplayRequests {
  /** 排期最终绑定的申请 ID */
  replayRequestId: number
  /** 本次被履行的全部申请人（去重），用于发送通知 */
  replayRequesterIds: number[]
}

interface RestoreReplayRequestsParams {
  tx: any
  songIds: number[]
  at: Date
}

/**
 * 发布排期时履行该歌曲的全部待处理重播申请，并把排期绑定到其中一条申请上。
 * 歌曲被安排播放即视为所有申请人的诉求都已满足，避免残留永远无人处理的 PENDING 记录。
 * 采用单条 UPDATE + RETURNING，避免先查后改窗口内新增的申请被履行却漏发通知。
 * 最终绑定由调用方在当前事务中解析并校验。
 */
export async function fulfillReplayRequestsForSchedule({
  tx,
  songId,
  scheduleId,
  at,
  resolvedRequestId
}: FulfillReplayRequestsParams): Promise<FulfilledReplayRequests | null> {
  if (resolvedRequestId === null) {
    await tx.update(schedules).set({ replayRequestId: null, updatedAt: at }).where(eq(schedules.id, scheduleId))
    return null
  }
  const fulfilledRequests: Array<{ id: number; userId: number; createdAt: Date }> = await tx
    .update(songReplayRequests)
    .set({
      status: 'FULFILLED',
      updatedAt: at
    })
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.status, 'PENDING')))
    .returning({
      id: songReplayRequests.id,
      userId: songReplayRequests.userId,
      createdAt: songReplayRequests.createdAt
    })

  await tx
    .update(schedules)
    .set({
      replayRequestId: resolvedRequestId,
      updatedAt: at
    })
    .where(eq(schedules.id, scheduleId))

  return {
    replayRequestId: resolvedRequestId,
    replayRequesterIds: [...new Set(fulfilledRequests.map((request) => request.userId))]
  }
}

/**
 * 排期被删除或歌曲撤销已播放后，把重播申请恢复为待处理。
 * insert-only 模型下同一 (song_id, user_id) 可能累积多条已履行记录，
 * 仅恢复每人最新一条，且该用户已有待处理申请时跳过，避免违反部分唯一索引。
 * 返回实际恢复的申请数量。
 */
export async function restoreReplayRequestsToPending({
  tx,
  songIds,
  at
}: RestoreReplayRequestsParams): Promise<number> {
  const validSongIds = songIds.filter((id) => Number.isInteger(id) && id > 0)
  if (validSongIds.length === 0) {
    return 0
  }

  // drizzle 原生 SQL 模板不能序列化 JS 数组和 Date（列为 timestamp 无时区），逐个参数化并传 ISO 字符串
  const songIdList = sql.join(
    validSongIds.map((id) => sql`${id}`),
    sql`, `
  )

  const restored = await tx.execute(sql`
    UPDATE song_replay_requests AS r
    SET status = 'PENDING', updated_at = ${at.toISOString()}
    WHERE r.id IN (
      SELECT DISTINCT ON (song_id, user_id) id
      FROM song_replay_requests
      WHERE song_id IN (${songIdList}) AND status = 'FULFILLED'
      ORDER BY song_id, user_id, created_at DESC
    )
      AND NOT EXISTS (
        SELECT 1 FROM song_replay_requests p
        WHERE p.song_id = r.song_id AND p.user_id = r.user_id AND p.status = 'PENDING'
      )
    RETURNING r.id
  `)

  return Array.isArray(restored) ? restored.length : Number(restored?.count || 0)
}
