import { and, asc, eq, gte, lte } from 'drizzle-orm'
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
      // 源排期查询：按源时段过滤（若指定），需要 playTimeId 用于"保持原时段"场景
      const sourceWhere = [gte(schedules.playDate, fromStart), lte(schedules.playDate, fromEnd)]
      if (fromPlayTimeId !== null) {
        sourceWhere.push(eq(schedules.playTimeId, fromPlayTimeId))
      }
      const sourceSchedules = await tx
        .select({
          id: schedules.id,
          songId: schedules.songId,
          playTimeId: schedules.playTimeId,
          requesterId: songs.requesterId,
          songTitle: songs.title
        })
        .from(schedules)
        .innerJoin(songs, eq(schedules.songId, songs.id))
        .where(and(...sourceWhere))
        .orderBy(asc(schedules.sequence))

      if (sourceSchedules.length === 0) {
        return {
          movedCount: 0,
          skippedCount: 0,
          movedSongs: []
        }
      }

      const updateTime = getServerDate()
      // 按目标时段分组：toPlayTimeId 指定则统一目标时段，否则保持各歌曲原时段
      const groups = new Map<number | null, typeof sourceSchedules>()
      for (const s of sourceSchedules) {
        const targetPt = toPlayTimeId !== null ? toPlayTimeId : (s.playTimeId ?? null)
        if (!groups.has(targetPt)) groups.set(targetPt, [])
        groups.get(targetPt)!.push(s)
      }

      let movedCount = 0
      let skippedCount = 0
      const movedSongs: Array<{ songId: number; requesterId: number | null; songTitle: string }> = []

      for (const [targetPt, group] of groups) {
        // 查询目标日期+该时段已有排期，用于去重与计算起始 sequence
        const existWhere = [gte(schedules.playDate, toStart), lte(schedules.playDate, toEnd)]
        if (targetPt === null) {
          existWhere.push(eq(schedules.playTimeId, null))
        } else {
          existWhere.push(eq(schedules.playTimeId, targetPt))
        }
        const existing = await tx
          .select({ songId: schedules.songId, sequence: schedules.sequence })
          .from(schedules)
          .where(and(...existWhere))

        const existingSongIds = new Set(existing.map((e) => e.songId))
        const maxSequence = existing.reduce((max, e) => Math.max(max, e.sequence || 0), 0)

        let nextSequence = maxSequence + 1
        for (const s of group) {
          // 去重：目标时段已存在同一首歌则跳过
          if (existingSongIds.has(s.songId)) {
            skippedCount++
            continue
          }
          existingSongIds.add(s.songId)
          await tx
            .update(schedules)
            .set({
              playDate: toPlayDate,
              playTimeId: targetPt,
              sequence: nextSequence,
              updatedAt: updateTime
            })
            .where(eq(schedules.id, s.id))
          nextSequence++
          movedCount++
          movedSongs.push({ songId: s.songId, requesterId: s.requesterId, songTitle: s.songTitle })
        }
      }

      return { movedCount, skippedCount, movedSongs }
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
      movedCount: moveResult.movedCount,
      skippedCount: moveResult.skippedCount
    }
  } catch (error: any) {
    console.error('迁移排期日期失败:', error)
    throw createError({
      statusCode: 500,
      message: error.message || '迁移排期日期失败'
    })
  }
})
