import { db } from '~/drizzle/db'
import { schedules, songs, songReplayRequests } from '~/drizzle/schema'
import { and, desc, eq, gte, lte, ne } from 'drizzle-orm'
import { createSongSelectedNotification } from '../../services/notificationService'
import { redeemCardCodeForSchedule } from '~~/server/services/cardCodeLifecycleService'
import { getServerDate } from '~~/server/utils/serverTime'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有歌曲管理员及以上权限才能创建排期'
    })
  }

  const body = await readBody(event)

  if (!body.songId || !body.playDate) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID和播放日期不能为空'
    })
  }

  // 检查是否为草稿模式（默认直接发布）
  const isDraft = body.isDraft === true

  try {
    // 检查歌曲是否存在
    const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)

    const song = songResult[0]

    if (!song) {
      throw createError({
        statusCode: 404,
        message: '歌曲不存在'
      })
    }

    const transactionResult = await db.transaction(async (tx) => {
      // 获取序号，如果未提供则查找当天最大序号+1
      let sequence = body.sequence || 1

      if (!body.sequence) {
        // 解析输入的日期字符串
        const inputDateStr =
          typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()

        // 创建当天的开始和结束时间
        const startOfDay = new Date(inputDateStr + 'T00:00:00.000Z')
        const endOfDay = new Date(inputDateStr + 'T23:59:59.999Z')

        console.log('查询当天排期范围:', {
          输入日期: body.playDate,
          开始时间: startOfDay.toISOString(),
          结束时间: endOfDay.toISOString()
        })

        const sameDaySchedules = await tx
          .select()
          .from(schedules)
          .where(and(gte(schedules.playDate, startOfDay), lte(schedules.playDate, endOfDay)))
          .orderBy(desc(schedules.sequence))
          .limit(1)

        const latestSchedule = sameDaySchedules[0]
        if (latestSchedule) sequence = (latestSchedule.sequence || 0) + 1
      }

      // 解析输入的日期字符串，确保日期正确
      const inputDateStr =
        typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()

      // 直接使用输入的日期字符串，添加时间部分以避免时区问题
      const playDate = new Date(inputDateStr + 'T00:00:00.000Z')

      // 创建排期
      const scheduleResult = await tx
        .insert(schedules)
        .values({
          songId: body.songId,
          playDate: playDate,
          sequence: sequence,
          playTimeId: body.playTimeId || null,
          // 草稿支持：根据参数决定是否为草稿
          isDraft: isDraft,
          publishedAt: isDraft ? null : getServerDate()
        })
        .returning()

      const createdSchedule = scheduleResult[0]
      if (!createdSchedule) {
        throw createError({ statusCode: 500, message: '创建排期失败' })
      }

      const schedule = {
        ...createdSchedule,
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          requesterId: song.requesterId,
          cardCodeId: song.cardCodeId
        }
      }

      let shouldNotify = false

      // 只有在非草稿模式下才更新重播状态
      if (!isDraft) {
        // 检查该歌曲是否已经有其他已发布的排期
        const existingPublished = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(
            and(
              eq(schedules.songId, schedule.song.id),
              eq(schedules.isDraft, false),
              ne(schedules.id, createdSchedule.id)
            )
          )
          .limit(1)

        // 如果之前没有正式发布过，才发送通知和更新重播状态
        shouldNotify = existingPublished.length === 0
        if (shouldNotify) {
          await tx
            .update(songReplayRequests)
            .set({
              status: 'FULFILLED',
              updatedAt: createdSchedule.publishedAt || getServerDate()
            })
            .where(
              and(
                eq(songReplayRequests.songId, schedule.song.id),
                eq(songReplayRequests.status, 'PENDING')
              )
            )
        } else {
          console.log(`歌曲 ${schedule.song.id} 已有其他正式排期，不再重复发送通知或更新重播状态`)
        }
        await redeemCardCodeForSchedule(tx, {
          songId: schedule.song.id,
          cardCodeId: schedule.song.cardCodeId,
          operatorId: user.id,
          at: createdSchedule.publishedAt || getServerDate()
        })
      }

      return { schedule, shouldNotify }
    })

    let notificationSent = true
    if (transactionResult.shouldNotify) {
      try {
        await createSongSelectedNotification(song.requesterId, song.id, {
          title: song.title,
          artist: song.artist,
          playDate: transactionResult.schedule.playDate
        })
      } catch (notificationError) {
        notificationSent = false
        console.error('排期已创建，但发送歌曲入选通知失败:', notificationError)
      }
    }

    const schedule = transactionResult.schedule

    return {
      ...schedule,
      isDraft: isDraft,
      publishedAt: isDraft ? null : schedule.publishedAt,
      message: isDraft
        ? '排期草稿保存成功'
        : transactionResult.shouldNotify
          ? notificationSent
            ? '排期创建成功，通知已发送'
            : '排期创建成功，但通知发送失败'
          : '排期创建成功'
    }
  } catch (error: any) {
    console.error('创建排期失败:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: error.message || '创建排期失败'
    })
  }
})
