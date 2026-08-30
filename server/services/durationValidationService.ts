import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { fetchSongDuration } from '~~/server/utils/songDurationFetcher'
import {
  decideDurationOutcome,
  type SongDurationDecision
} from '~~/server/utils/song-duration-policy'

/** 后台批量补齐的并发数 */
const BACKFILL_BATCH_SIZE = 5

/**
 * 投稿后处理时长：缺失则按音源补齐，已有则校验一致性
 * 仅返回决策，写库由调用方负责
 */
export async function reconcileSongDurationOnSubmit(
  songId: number,
  platform: string | null,
  musicId: string | null,
  storedDurationSeconds: number | null
): Promise<SongDurationDecision> {
  if (!platform || !musicId) {
    return { outcome: 'nocheck', durationSeconds: storedDurationSeconds }
  }

  try {
    const actualDuration = await fetchSongDuration(platform, musicId)
    const decision = decideDurationOutcome(storedDurationSeconds, actualDuration)
    if (decision.outcome === 'clear') {
      console.log(
        `[投稿时长] #${songId} 时长不符 (提交: ${storedDurationSeconds}s, API: ${actualDuration}s)，清除durationSeconds`
      )
    }
    return decision
  } catch (error) {
    // 外部接口异常时保留原值，不因为后台问题影响用户投稿
    console.error(`[投稿时长] #${songId} 处理失败:`, error)
    return { outcome: 'nocheck', durationSeconds: storedDurationSeconds }
  }
}

export interface SongDurationBackfillRow {
  id: number
  musicPlatform: string | null
  musicId: string | null
}

type BackfillableRow = SongDurationBackfillRow & { musicPlatform: string; musicId: string }

/** 批量补齐缺失时长，单条失败不影响其余 */
export async function backfillMissingSongDurations(rows: SongDurationBackfillRow[], label: string): Promise<void> {
  const targets = rows.filter(
    (row): row is BackfillableRow => Boolean(row.musicPlatform) && Boolean(row.musicId)
  )

  for (let i = 0; i < targets.length; i += BACKFILL_BATCH_SIZE) {
    const batch = targets.slice(i, i + BACKFILL_BATCH_SIZE)
    await Promise.all(
      batch.map(async (row) => {
        try {
          const duration = await fetchSongDuration(row.musicPlatform, row.musicId)
          if (duration === null) {
            console.warn(`[${label}] 歌曲 #${row.id} 未获取到有效时长`)
            return
          }
          await db.update(songs).set({ durationSeconds: duration }).where(eq(songs.id, row.id))
        } catch (error) {
          console.warn(`[${label}] 歌曲 #${row.id} 时长补齐失败:`, error)
        }
      })
    )
  }
}
