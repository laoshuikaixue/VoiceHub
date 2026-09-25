import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { playTimes, schedules, songs, songReplayRequests } from '~/drizzle/schema'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { restoreCardCodeAfterScheduleRemoval } from '~~/server/services/cardCodeLifecycleService'
import { restoreReplayRequestsToPending } from '~~/server/utils/scheduleReplayBinding'
import { getServerDate } from '~~/server/utils/serverTime'

const MAX_SCHEDULE_ITEMS = 1000

interface ScheduleItem {
  songId: number
  sequence: number
  replayRequestId: number | null
}

function parsePlayDate(value: unknown): string {
  const dateStr = typeof value === 'string' ? value : String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(new Date(dateStr).getTime())) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '播放日期格式必须为YYYY-MM-DD')
  }
  return dateStr
}

function parsePlayTimeId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const playTimeId = Number(value)
  if (!Number.isInteger(playTimeId) || playTimeId <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '播放时间ID必须是正整数')
  }
  return playTimeId
}

// 草稿整体保存：songs 数组顺序即播放顺序，序号由服务端按下标生成
function parseScheduleItems(value: unknown): ScheduleItem[] {
  if (!Array.isArray(value)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songs 必须是数组')
  }
  if (value.length > MAX_SCHEDULE_ITEMS) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `songs 最多 ${MAX_SCHEDULE_ITEMS} 条`)
  }

  return value.map((item: any, index: number) => {
    const songId = Number(item?.songId)
    if (!Number.isInteger(songId) || songId <= 0) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `第 ${index + 1} 条排期的歌曲ID无效`)
    }
    const rawReplayId = Number(item?.replayRequestId)
    const replayRequestId =
      Number.isInteger(rawReplayId) && rawReplayId > 0 ? rawReplayId : null

    return { songId, sequence: index + 1, replayRequestId }
  })
}

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)
  const user = event.context.user

  const body = await readBody(event)
  const inputDateStr = parsePlayDate(body?.playDate)
  const playTimeId = parsePlayTimeId(body?.playTimeId)
  const scheduleItems = parseScheduleItems(body?.songs)

  const playDate = new Date(inputDateStr + 'T00:00:00.000Z')
  const startOfDay = new Date(inputDateStr + 'T00:00:00.000Z')
  const endOfDay = new Date(inputDateStr + 'T23:59:59.999Z')

  const whereConditions = [
    gte(schedules.playDate, startOfDay),
    lte(schedules.playDate, endOfDay)
  ]
  if (playTimeId) {
    whereConditions.push(eq(schedules.playTimeId, playTimeId))
  }

  const songIds = Array.from(new Set(scheduleItems.map((item) => item.songId)))
  const replayRequestIds = Array.from(
    new Set(
      scheduleItems
        .map((item) => item.replayRequestId)
        .filter((id): id is number => id !== null)
    )
  )

  const result = await db.transaction(async (tx) => {
    if (playTimeId) {
      const playTime = await tx
        .select({ id: playTimes.id })
        .from(playTimes)
        .where(eq(playTimes.id, playTimeId))
        .limit(1)
      if (playTime.length === 0) {
        throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '播放时间不存在')
      }
    }

    if (songIds.length > 0) {
      const existingSongs = await tx
        .select({ id: songs.id })
        .from(songs)
        .where(inArray(songs.id, songIds))
      const existingSongIds = new Set(existingSongs.map((song) => song.id))
      const missingSongIds = songIds.filter((songId) => !existingSongIds.has(songId))
      if (missingSongIds.length > 0) {
        throw createApiError(
          404,
          SERVER_ERROR_CODES.SONG_NOT_FOUND,
          `歌曲不存在：${missingSongIds.join(', ')}`
        )
      }
    }

    // 草稿仅记录重播绑定，不改动申请状态
    if (replayRequestIds.length > 0) {
      const replayRequests = await tx
        .select({
          id: songReplayRequests.id,
          songId: songReplayRequests.songId,
          status: songReplayRequests.status
        })
        .from(songReplayRequests)
        .where(inArray(songReplayRequests.id, replayRequestIds))
      const replayMap = new Map(replayRequests.map((request) => [request.id, request]))
      for (const item of scheduleItems) {
        if (item.replayRequestId === null) continue
        const request = replayMap.get(item.replayRequestId)
        if (!request || request.songId !== item.songId || request.status !== 'PENDING') {
          throw createApiError(
            400,
            SERVER_ERROR_CODES.SONG_REPLAY_INVALID_REQUEST,
            '重播申请无效或已被处理'
          )
        }
      }
    }

    // 覆盖前先取出窗口内排期，用于返还被移除的已发布排期的点歌券与重播申请
    const schedulesToReplace = await tx
      .select({
        songId: schedules.songId,
        isDraft: schedules.isDraft,
        cardCodeId: songs.cardCodeId
      })
      .from(schedules)
      .leftJoin(songs, eq(schedules.songId, songs.id))
      .where(and(...whereConditions))

    await tx.delete(schedules).where(and(...whereConditions))

    // 与逐条移除排期的行为保持一致：被覆盖的已发布排期一律返还点歌券、回退重播申请，
    // 否则草稿转正式发布时找不到 PENDING 申请，重播标识会丢失
    const removedPublishedSongIds = Array.from(
      new Set(
        schedulesToReplace.filter((s) => !s.isDraft).map((s) => s.songId)
      )
    )

    if (removedPublishedSongIds.length > 0) {
      const otherPublished = await tx
        .select({ songId: schedules.songId })
        .from(schedules)
        .where(
          and(
            eq(schedules.isDraft, false),
            inArray(schedules.songId, removedPublishedSongIds)
          )
        )
      const songsWithOtherSchedules = new Set(otherPublished.map((s) => s.songId))
      const finalRestoreIds = removedPublishedSongIds.filter(
        (songId) => !songsWithOtherSchedules.has(songId)
      )

      if (finalRestoreIds.length > 0) {
        const finalRestoreIdSet = new Set(finalRestoreIds)
        const restoreCardCodeMap = new Map<number, number>()
        for (const replaced of schedulesToReplace) {
          if (
            !replaced.isDraft &&
            replaced.cardCodeId &&
            finalRestoreIdSet.has(replaced.songId)
          ) {
            restoreCardCodeMap.set(replaced.songId, replaced.cardCodeId)
          }
        }

        for (const [songId, cardCodeId] of restoreCardCodeMap) {
          const restoreResult = await restoreCardCodeAfterScheduleRemoval(tx, {
            songId,
            cardCodeId,
            operatorId: user.id
          })
          if (
            !restoreResult.changed &&
            ['CONCURRENT_CHANGE', 'MISSING_CARD_CODE'].includes(
              String(restoreResult.reason || '')
            )
          ) {
            throw createApiError(409, SERVER_ERROR_CODES.SONG_CARD_RESTORE_FAILED, '点歌券返还失败，保存草稿已终止')
          }
        }

        await restoreReplayRequestsToPending({
          tx,
          songIds: finalRestoreIds,
          at: getServerDate()
        })
      }
    }

    if (scheduleItems.length > 0) {
      await tx.insert(schedules).values(
        scheduleItems.map((item) => ({
          songId: item.songId,
          playDate,
          sequence: item.sequence,
          playTimeId,
          replayRequestId: item.replayRequestId,
          isDraft: true,
          publishedAt: null
        }))
      )
    }

    return scheduleItems.length
  })

  return {
    success: true,
    count: result,
    message: '排期草稿保存成功'
  }
})
