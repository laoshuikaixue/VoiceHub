import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { schedules, songs } from '~/drizzle/schema'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getServerDate } from '~~/server/utils/serverTime'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要歌曲管理员及以上权限'
    })
  }

  const startTime = Date.now()
  const clientIP = getClientIP(event)

  const body = await readBody(event)
  const fromDate = typeof body?.fromDate === 'string' ? body.fromDate.trim() : ''
  const toDate = typeof body?.toDate === 'string' ? body.toDate.trim() : ''

  if (!fromDate || !toDate) {
    throw createError({
      statusCode: 400,
      message: '缺少来源日期或目标日期'
    })
  }

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
    const copyResult = await db.transaction(async (tx) => {
      // 检查目标日期是否已有排期
      const existingOnToDate = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd)))
        .limit(1)

      if (existingOnToDate.length > 0) {
        throw createError({
          statusCode: 409,
          message: '目标日期已存在排期，无法复制。请先清空目标日期的排期。'
        })
      }

      // 查询来源日期的所有排期（含草稿和已发布），按 sequence 排序
      const sourceSchedules = await tx
        .select({
          songId: schedules.songId,
          sequence: schedules.sequence,
          playTimeId: schedules.playTimeId
        })
        .from(schedules)
        .innerJoin(songs, eq(schedules.songId, songs.id))
        .where(and(gte(schedules.playDate, fromStart), lte(schedules.playDate, fromEnd)))
        .orderBy(schedules.sequence)

      if (sourceSchedules.length === 0) {
        return {
          copiedCount: 0
        }
      }

      let copiedCount = 0
      const now = getServerDate()

      for (const source of sourceSchedules) {
        await tx
          .insert(schedules)
          .values({
            songId: source.songId,
            playDate: toPlayDate,
            sequence: source.sequence,
            playTimeId: source.playTimeId,
            isDraft: true, // 复制的排期默认保存为草稿，管理员审核后发布
            publishedAt: null,
            updatedAt: now
          })

        copiedCount++
      }

      return { copiedCount }
    })

    console.log(`[Performance] 复制排期耗时: ${Date.now() - startTime}ms`)

    return {
      success: true,
      fromDate,
      toDate,
      copiedCount: copyResult.copiedCount
    }
  } catch (error: any) {
    if (error?.statusCode === 409) {
      throw error
    }
    console.error('复制排期失败:', {
      error: error.message,
      userId: user?.id,
      ip: clientIP,
      duration: Date.now() - startTime
    })
    throw createError({
      statusCode: 500,
      message: error.message || '复制排期失败'
    })
  }
})