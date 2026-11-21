import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { playTimes, schedules, songs } from '~/drizzle/schema'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { parseScheduleReplayRequestId, resolveScheduleReplayBindings } from '~~/server/utils/scheduleReplayBinding'
import { assertSchedulePlacement, loadSongTitleMap } from '~~/server/utils/schedulePlacementConstraint'

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
    const replayRequestId = parseScheduleReplayRequestId(item?.replayRequestId)

    return { songId, sequence: index + 1, replayRequestId }
  })
}

import { recordAdminAudit } from '~~/server/utils/admin-audit'
export default defineEventHandler(async (event) => {
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

    // 覆盖前先取出窗口内排期，用于返还被移除的已发布排期的点歌券与重播申请
    const schedulesToReplace = await tx
      .select({
        songId: schedules.songId,
        replayRequestId: schedules.replayRequestId,
        isDraft: schedules.isDraft
      })
      .from(schedules)
      .where(and(...whereConditions))

    const previousBindings = new Map<number, number>()
    for (const schedule of schedulesToReplace) {
      if (schedule.replayRequestId) previousBindings.set(schedule.songId, schedule.replayRequestId)
    }
    const resolvedItems = await resolveScheduleReplayBindings(tx, scheduleItems, previousBindings)
    await assertSchedulePlacement(
      { playTimeId, items: resolvedItems, allowOverride: body.allowPlacementOverride === true },
      await loadSongTitleMap(songIds, tx),
      tx
    )

    await tx.delete(schedules).where(and(...whereConditions, eq(schedules.isDraft, true)))

    if (scheduleItems.length > 0) {
      await tx.insert(schedules).values(
        resolvedItems.map((item) => ({
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

  await recordAdminAudit(event, 'schedule.bulk-draft', {
    targetType: 'schedule',
    targetId: `batch:${result}`,
    summary: { count: result, playDate, playTimeId: playTimeId ?? null }
  })

  return {
    success: true,
    count: result,
    message: '排期草稿保存成功'
  }
})
