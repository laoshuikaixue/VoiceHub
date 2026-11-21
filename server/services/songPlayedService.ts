import type { H3Event } from 'h3'
import { db } from '~/drizzle/db'
import { songs, songReplayRequests } from '~/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import { restoreReplayRequestsToPending } from '~~/server/utils/scheduleReplayBinding'
import { createSongPlayedNotifications } from '~~/server/services/notificationService'
import { redeemCardCodeForSchedule, restoreCardCodeAfterScheduleRemoval } from '~~/server/services/cardCodeLifecycleService'
import { enqueueAstrbotGroupEvent } from '~~/server/services/astrbotGroupService'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function updateSongPlayed(
  tx: Transaction, songIds: number[], operatorId: number, isUnmark = false
) {
  // 过滤需要更新的歌曲
  const condition = !isUnmark
    ? and(inArray(songs.id, songIds), eq(songs.played, false))
    : and(inArray(songs.id, songIds), eq(songs.played, true))

  const updatedSongsResult = await tx
    .update(songs)
    .set({
      played: !isUnmark,
      playedAt: isUnmark ? null : getServerDate()
    })
    .where(condition)
    .returning({ id: songs.id, cardCodeId: songs.cardCodeId })

  const updatedSongIds = updatedSongsResult.map((s) => s.id)
  for (const song of updatedSongsResult) {
    const transition = isUnmark ? restoreCardCodeAfterScheduleRemoval : redeemCardCodeForSchedule
    await transition(tx, { songId: song.id, cardCodeId: song.cardCodeId, operatorId, at: getServerDate(), cancelPlayback: isUnmark })
  }

  if (updatedSongIds.length > 0) {
    if (!isUnmark) {
      // 标记已播放：履行全部待处理的重播申请
      const updatedRequests = await tx
        .update(songReplayRequests)
        .set({
          status: 'FULFILLED',
          updatedAt: getServerDate()
        })
        .where(
          and(
            inArray(songReplayRequests.songId, updatedSongIds),
            eq(songReplayRequests.status, 'PENDING')
          )
        )
        .returning({ id: songReplayRequests.id })

      if (updatedRequests.length > 0) {
        console.log(`将 ${updatedRequests.length} 个重播申请状态更新为 FULFILLED（歌曲已播放）`)
      }
    } else {
      // 撤回已播放：每人仅恢复最新一条，避免违反部分唯一索引
      const restoredCount = await restoreReplayRequestsToPending({
        tx,
        songIds: updatedSongIds,
        at: getServerDate()
      })

      if (restoredCount > 0) {
        console.log(`将 ${restoredCount} 个重播申请状态恢复为 PENDING（撤回已播放）`)
      }
    }
  }

  return updatedSongIds
}

export function notifySongsPlayed(event: H3Event, updatedSongIds: number[]) {
  // 异步发送通知（同一用户多首歌曲合并为一条）
  if (updatedSongIds.length > 0) {
    event.waitUntil(
      createSongPlayedNotifications(updatedSongIds).catch((err) => {
        console.error('发送歌曲已播放通知失败:', err)
      })
    )
    // 群聊推送：歌曲已播放（默认关闭，噪音较大，按需在后台开启）。
    // 批量标播放时逐首发一条，但同群同事件的合并窗口会把它们并成一条消息。
    event.waitUntil((async () => {
      try {
        const played = await db.select({ title: songs.title, artist: songs.artist })
          .from(songs).where(inArray(songs.id, updatedSongIds))
        for (const song of played) {
          await enqueueAstrbotGroupEvent('songPlayed', '歌曲已播放', `《${song.title}》- ${song.artist} 已播放`)
        }
      } catch (err) {
        console.error('发送群聊已播放通知失败:', err)
      }
    })())
  }
}
