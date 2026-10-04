import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { schedules, songs } from '~/drizzle/schema'
import { createSystemNotification } from '~~/server/services/notificationService'
import { getServerDate } from '~~/server/utils/serverTime'

const parsePlayTimeId = (raw: unknown): number | null => {
  if (raw === undefined || raw === null || raw === '') return null
  const num = Number(raw)
  return Number.isInteger(num) && num > 0 ? num : null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要歌曲管理员及以上权限'
    })
  }

  const body = await readBody(event)
  const fromDate = typeof body?.fromDate === 'string' ? body.fromDate.trim() : ''
  const toDate = typeof body?.toDate === 'string' ? body.toDate.trim() : ''
  const fromPlayTimeId = parsePlayTimeId(body?.fromPlayTimeId)
  const toPlayTimeId = parsePlayTimeId(body?.toPlayTimeId)

  // 仅当既不改变日期也不改变时段时才视为无意义操作
  if (fromDate === toDate && fromPlayTimeId === null && toPlayTimeId === null) {
    throw createError({
      statusCode: 400,
      message: '目标日期与时段均未改变'
    })
  }

  const fromStart = new Date(`${fromDate}T00:00:00.000Z`)
  const fromEnd = new Date(`${fromDate}T23:59:59.999Z`)
  const toPlayDate = new Date(`${toDate}T00:00:00.000Z`)
  const toStart = new Date(`${toDate}T00:00:00.000Z`)
  const toEnd = new Date(`${toDate}T23:59:59.999Z`)

  if (
    Number.isNaN(fromStart.getTime()) ||
    Number.isNaN(fromEnd.getTime()) ||
    Number.isNaN(toPlayDate.getTime()) ||
    Number.isNaN(toStart.getTime()) ||
    Number.isNaN(toEnd.getTime()) ||
    fromStart.toISOString().split('T')[0] !== fromDate ||
    toPlayDate.toISOString().split('T')[0] !== toDate
  ) {
    throw createError({
      statusCode: 400,
      message: '日期无效，请使用 YYYY-MM-DD 格式并确保日期有效'
    })
  }

  try {
    const moveResult = await db.transaction(async (tx) => {
      // 冲突校验：若指定了目标时段，只校验目标时段；否则校验目标日期全天
      const conflictWhere = [gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd)]
      if (toPlayTimeId !== null) {
        conflictWhere.push(eq(schedules.playTimeId, toPlayTimeId))
      }
      const existingOnTarget = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(...conflictWhere))
        .limit(1)

      if (existingOnTarget.length > 0) {
        throw createError({
          statusCode: 409,
          message: toPlayTimeId !== null
            ? '目标时段已存在排期，无法迁移。请先清空目标时段的排期。'
            : '目标日期已存在排期，无法迁移。请先清空目标日期的排期。'
        })
      }

      // 源排期查询：按源时段过滤（若指定）
      const sourceWhere = [gte(schedules.playDate, fromStart), lte(schedules.playDate, fromEnd)]
      if (fromPlayTimeId !== null) {
        sourceWhere.push(eq(schedules.playTimeId, fromPlayTimeId))
      }
      const sourceSchedules = await tx
        .select({
          id: schedules.id,
          songId: schedules.songId,
          requesterId: songs.requesterId,
          songTitle: songs.title
        })
        .from(schedules)
        .innerJoin(songs, eq(schedules.songId, songs.id))
        .where(and(...sourceWhere))

      if (sourceSchedules.length === 0) {
        return {
          movedCount: 0,
          movedSongs: []
        }
      }

      const scheduleIds = sourceSchedules.map((item) => item.id)
      const updateTime = getServerDate()
      const updateSet: Record<string, any> = {
        playDate: toPlayDate,
        updatedAt: updateTime
      }
      if (toPlayTimeId !== null) {
        updateSet.playTimeId = toPlayTimeId
      }
      const movedSchedules = await tx
        .update(schedules)
        .set(updateSet)
        .where(inArray(schedules.id, scheduleIds))
        .returning({
          id: schedules.id
        })

      return {
        movedCount: movedSchedules.length,
        movedSongs: sourceSchedules
      }
    })

    const notificationsToSend = moveResult.movedSongs.map((item) => {
      const message = `您投稿的歌曲《${item.songTitle}》原定于 ${fromDate} 播放，已调整至 ${toDate}。`
      return createSystemNotification(item.requesterId, '排期调整通知', message)
    })

    if (notificationsToSend.length > 0) {
      Promise.allSettled(notificationsToSend).catch((error) => {
        console.error('[Notification] 发送排期迁移通知失败:', error)
      })
    }

    return {
      success: true,
      fromDate,
      toDate,
      fromPlayTimeId,
      toPlayTimeId,
      movedCount: moveResult.movedCount
    }
  } catch (error: any) {
    if (error?.statusCode === 409) {
      throw error
    }
    console.error('迁移排期日期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '迁移排期日期失败'
    })
  }
})
