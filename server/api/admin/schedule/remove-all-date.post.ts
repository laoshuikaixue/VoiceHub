import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { schedules } from '~/drizzle/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 回滚辅助接口：仅删除指定批次创建的排期，并可恢复被覆盖的草稿
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const body = await readBody(event)
  const scheduleIds = Array.isArray(body?.scheduleIds)
    ? body.scheduleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : []
  const restoreSchedules = Array.isArray(body?.restoreSchedules) ? body.restoreSchedules : []
  if ((scheduleIds.length === 0 && restoreSchedules.length === 0) || scheduleIds.length > 1000 || restoreSchedules.length > 1000) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'scheduleIds 或 restoreSchedules 必须包含 1-1000 条记录')
  }
  const result = await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(schedules)
      .where(and(inArray(schedules.id, scheduleIds), eq(schedules.isDraft, true), isNull(schedules.publishedAt)))
      .returning({ id: schedules.id })
    if (restoreSchedules.length > 0) {
      await tx.insert(schedules).values(restoreSchedules.map((schedule) => ({
        id: Number(schedule.id),
        createdAt: new Date(schedule.createdAt),
        updatedAt: new Date(schedule.updatedAt),
        songId: Number(schedule.songId),
        playDate: new Date(schedule.playDate),
        played: Boolean(schedule.played),
        sequence: Number(schedule.sequence),
        playTimeId: schedule.playTimeId == null ? null : Number(schedule.playTimeId),
        isDraft: true,
        publishedAt: null,
        replayRequestId: schedule.replayRequestId == null ? null : Number(schedule.replayRequestId)
      })))
    }
    return deleted
  })

  return { success: true, removed: result.length, restored: restoreSchedules.length }
})
