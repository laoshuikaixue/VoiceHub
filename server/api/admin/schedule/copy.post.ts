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
  const overwriteDrafts = body?.overwriteDrafts === true

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

  const copyResult = await db.transaction(async (tx) => {
    // 检查目标日期是否已有排期（含草稿）
    const [existingCount, draftCount] = await Promise.all([
      tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd), eq(schedules.isDraft, false)))
        .limit(1),
      tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd), eq(schedules.isDraft, true)))
        .limit(999)
    ])

    const hasExistingSchedule = existingCount.length > 0
    const overwritingDrafts = overwriteDrafts && draftCount.length > 0

    // 有已发布排期不允许复制
    if (hasExistingSchedule) {
      throw createError({
        statusCode: 409,
        message: '目标日期已存在已发布排期，无法复制。请先清空目标日期的排期。'
      })
    }

    // 有草稿但未请求覆盖，返回信息供前端询问用户
    if (draftCount.length > 0 && !overwritingDrafts) {
      throw createError({
        statusCode: 409,
        message: '目标日期已存在草稿，请确认是否覆盖。',
        data: { draftCount: draftCount.length, requiresConfirmation: true }
      })
    }

    let replacedDrafts = []

    // 清除目标日期草稿（如用户确认覆盖）
    if (overwritingDrafts) {
      replacedDrafts = await tx
        .select()
        .from(schedules)
        .where(and(gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd), eq(schedules.isDraft, true)))
      await tx.delete(schedules).where(and(gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd)))
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
      return { copiedCount: 0, createdScheduleIds: [], replacedDrafts }
    }

    let copiedCount = 0
    const createdScheduleIds = []
    const now = getServerDate()

    for (const source of sourceSchedules) {
      const inserted = await tx
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
        .returning({ id: schedules.id })

      copiedCount++
      if (inserted[0]) createdScheduleIds.push(inserted[0].id)
    }

    return { copiedCount, createdScheduleIds, replacedDrafts }
  })

  console.log(`[Performance] 复制排期耗时: ${Date.now() - startTime}ms`)

  return {
    success: true,
    fromDate,
    toDate,
    copiedCount: copyResult.copiedCount ?? 0,
    createdScheduleIds: copyResult.createdScheduleIds ?? [],
    replacedDrafts: copyResult.replacedDrafts ?? [],
    draftCount: copyResult.draftCount,
    overwriteDrafts: copyResult.overwriteDrafts
  }
})
