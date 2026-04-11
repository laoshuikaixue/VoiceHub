import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { schedules, songs } from '~/drizzle/schema'
import { cacheService } from '~~/server/services/cacheService'
import { createSystemNotification } from '~~/server/services/notificationService'
import { getClientIP } from '~~/server/utils/ip-utils'

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

  if (fromDate === toDate) {
    throw createError({
      statusCode: 400,
      message: '目标日期不能与当前日期相同'
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
      const existingOnToDate = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd)))
        .limit(1)

      if (existingOnToDate.length > 0) {
        throw createError({
          statusCode: 409,
          message: '目标日期已存在排期，无法迁移。请先清空目标日期的排期。'
        })
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
        .where(and(gte(schedules.playDate, fromStart), lte(schedules.playDate, fromEnd)))

      if (sourceSchedules.length === 0) {
        return {
          movedCount: 0,
          movedSongs: []
        }
      }

      const scheduleIds = sourceSchedules.map((item) => item.id)
      const updateTime = new Date()
      const movedSchedules = await tx
        .update(schedules)
        .set({
          playDate: toPlayDate,
          updatedAt: updateTime
        })
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

    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache()
      console.log('[Cache] 排期缓存和歌曲列表缓存已清除（迁移排期日期）')
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      fromDate,
      toDate,
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
