import { and, gte, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { schedules } from '~/drizzle/schema'
import { cacheService } from '~~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '需要歌曲管理员及以上权限'
    })
  }

  const body = await readBody(event)
  const fromDate = typeof body?.fromDate === 'string' ? body.fromDate.trim() : ''
  const toDate = typeof body?.toDate === 'string' ? body.toDate.trim() : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw createError({
      statusCode: 400,
      statusMessage: '日期格式无效，请使用 YYYY-MM-DD'
    })
  }

  if (fromDate === toDate) {
    throw createError({
      statusCode: 400,
      statusMessage: '目标日期不能与当前日期相同'
    })
  }

  const fromStart = new Date(`${fromDate}T00:00:00.000Z`)
  const fromEnd = new Date(`${fromDate}T23:59:59.999Z`)
  const toPlayDate = new Date(`${toDate}T00:00:00.000Z`)

  if (
    Number.isNaN(fromStart.getTime()) ||
    Number.isNaN(fromEnd.getTime()) ||
    Number.isNaN(toPlayDate.getTime()) ||
    fromStart.toISOString().split('T')[0] !== fromDate ||
    toPlayDate.toISOString().split('T')[0] !== toDate
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: '日期无效'
    })
  }

  try {
    const updateTime = new Date()
    const movedSchedules = await db
      .update(schedules)
      .set({
        playDate: toPlayDate,
        updatedAt: updateTime
      })
      .where(and(gte(schedules.playDate, fromStart), lte(schedules.playDate, fromEnd)))
      .returning({
        id: schedules.id
      })

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
      movedCount: movedSchedules.length
    }
  } catch (error: any) {
    console.error('迁移排期日期失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '迁移排期日期失败'
    })
  }
})
