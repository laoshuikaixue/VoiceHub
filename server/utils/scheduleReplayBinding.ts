import { and, desc, eq } from 'drizzle-orm'
import { schedules, songReplayRequests } from '~/drizzle/schema'

interface BindReplayRequestParams {
  tx: any
  songId: number
  scheduleId: number
  at: Date
}

interface BoundReplayRequest {
  replayRequestId: number
  replayRequesterIds: number[]
}

export async function bindLatestPendingReplayRequestToSchedule({
  tx,
  songId,
  scheduleId,
  at
}: BindReplayRequestParams): Promise<BoundReplayRequest | null> {
  const pendingReplayRequests = await tx
    .select()
    .from(songReplayRequests)
    .where(and(eq(songReplayRequests.songId, songId), eq(songReplayRequests.status, 'PENDING')))
    .orderBy(desc(songReplayRequests.createdAt))
    .limit(1)

  const pending = pendingReplayRequests[0]
  if (!pending) {
    return null
  }

  await tx
    .update(songReplayRequests)
    .set({
      status: 'FULFILLED',
      updatedAt: at
    })
    .where(eq(songReplayRequests.id, pending.id))

  await tx
    .update(schedules)
    .set({
      replayRequestId: pending.id,
      updatedAt: at
    })
    .where(eq(schedules.id, scheduleId))

  return {
    replayRequestId: pending.id,
    replayRequesterIds: [pending.userId]
  }
}
