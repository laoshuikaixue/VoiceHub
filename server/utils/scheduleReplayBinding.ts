import { and, eq, sql } from 'drizzle-orm'
import { schedules, songReplayRequests } from '~/drizzle/schema'

interface FulfillReplayRequestsParams {
  tx: any
  songId: number
  scheduleId: number
  at: Date
  /** 草稿排期显式绑定的申请 ID；未提供或已失效时回退到最早的待处理申请 */
  preferredRequestId?: number | null
  /** 重发排期前的旧绑定；无任何待处理申请时回写该绑定，避免重播标识丢失 */
  fallbackRequestId?: number | null
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
 * 若没有任何待处理申请：优先回写 fallbackRequestId（重发排期场景），否则清除失效绑定并返回 null。
 */
export async function fulfillReplayRequestsForSchedule({
  tx,
  songId,
  scheduleId,
  at,
  preferredRequestId,
  fallbackRequestId
}: FulfillReplayRequestsParams): Promise<FulfilledReplayRequests | null> {
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

  // 按先到先得排序，便于回退绑定最早的申请
  fulfilledRequests.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const earliestRequest = fulfilledRequests[0]
  if (!earliestRequest) {
    // 无待处理申请：重发排期时保留原绑定，否则清除草稿残留的失效绑定
    const restoredBinding = fallbackRequestId || null
    await tx
      .update(schedules)
      .set({ replayRequestId: restoredBinding, updatedAt: at })
      .where(eq(schedules.id, scheduleId))
    return restoredBinding ? { replayRequestId: restoredBinding, replayRequesterIds: [] } : null
  }

  // 优先使用草稿显式绑定的申请，否则绑定最早的待处理申请
  const boundRequest =
    (preferredRequestId &&
      fulfilledRequests.find((request) => request.id === preferredRequestId)) ||
    earliestRequest

  await tx
    .update(schedules)
    .set({
      replayRequestId: boundRequest.id,
      updatedAt: at
    })
    .where(eq(schedules.id, scheduleId))

  return {
    replayRequestId: boundRequest.id,
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
