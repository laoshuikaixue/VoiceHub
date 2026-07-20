import { db } from '~/drizzle/db'
import { schedules, songs, songReplayRequests } from '~/drizzle/schema'
import { and, eq, ne } from 'drizzle-orm'
import { createSongSelectedNotification } from '~~/server/services/notificationService'
import { getBeijingTimestamp } from '~/utils/timeUtils'
import { redeemCardCodeForSchedule } from '~~/server/services/cardCodeLifecycleService'

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
      message: '只有歌曲管理员及以上权限才能发布排期'
    })
  }

  const body = await readBody(event)

  if (!body.scheduleId) {
    throw createError({
      statusCode: 400,
      message: '排期ID不能为空'
    })
  }

  try {
    // 检查草稿是否存在
    const draftResult = await db
      .select({
        id: schedules.id,
        songId: schedules.songId,
        playDate: schedules.playDate,
        sequence: schedules.sequence,
        playTimeId: schedules.playTimeId,
        isDraft: schedules.isDraft,
        publishedAt: schedules.publishedAt,
        song: {
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          requesterId: songs.requesterId,
          cardCodeId: songs.cardCodeId
        }
      })
      .from(schedules)
      .innerJoin(songs, eq(schedules.songId, songs.id))
      .where(
        and(
          eq(schedules.id, body.scheduleId),
          eq(schedules.isDraft, true) // 确保是草稿状态
        )
      )
      .limit(1)

    const draft = draftResult[0]

    if (!draft) {
      throw createError({
        statusCode: 404,
        message: '找不到指定的排期草稿'
      })
    }

    // 使用事务包装更新排期和重播申请状态操作，保证原子性
    const publishResult = await db.transaction(async (tx) => {
      // 更新草稿为已发布状态
      const publishedAt = new Date(getBeijingTimestamp())

      const publishResult = await tx
        .update(schedules)
        .set({
          isDraft: false,
          publishedAt: publishedAt,
          updatedAt: publishedAt
        })
        .where(and(eq(schedules.id, body.scheduleId), eq(schedules.isDraft, true)))
        .returning()

      const schedule = publishResult[0]

      if (!schedule) {
        throw createError({ statusCode: 409, message: '排期已发布或状态已变化，请刷新后重试' })
      }

      // 检查该歌曲是否已经有其他已发布的排期
      const existingPublished = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(
          and(
            eq(schedules.songId, draft.song.id),
            eq(schedules.isDraft, false),
            ne(schedules.id, body.scheduleId)
          )
        )
        .limit(1)

      const shouldNotify = existingPublished.length === 0
      // 如果之前没有正式发布过，只更新重播状态；通知在事务提交后发送。
      if (shouldNotify) {
        // 将该歌曲的所有待处理重播申请标记为已完成
        const updatedRequests = await tx
          .update(songReplayRequests)
          .set({
            status: 'FULFILLED',
            updatedAt: publishedAt
          })
          .where(
            and(
              eq(songReplayRequests.songId, draft.song.id),
              eq(songReplayRequests.status, 'PENDING')
            )
          )
          .returning({ id: songReplayRequests.id })

        if (updatedRequests.length > 0) {
          console.log(`发布排期：将 ${updatedRequests.length} 个重播申请标记为 FULFILLED`)
        }
      } else {
        console.log(`歌曲 ${draft.song.id} 已有其他正式排期，不再重复发送通知或更新重播状态`)
      }

      await redeemCardCodeForSchedule(tx, {
        songId: draft.song.id,
        cardCodeId: draft.song.cardCodeId,
        operatorId: user.id,
        at: publishedAt
      })

      return { schedule, shouldNotify }
    })

    let notificationSent = true
    if (publishResult.shouldNotify) {
      try {
        await createSongSelectedNotification(draft.song.requesterId, draft.song.id, {
          title: draft.song.title,
          artist: draft.song.artist,
          playDate: publishResult.schedule.playDate
        })
      } catch (notificationError) {
        notificationSent = false
        console.error('排期已发布，但发送歌曲入选通知失败:', notificationError)
      }
    }

    const publishedSchedule = publishResult.schedule

    return {
      ...draft,
      ...publishedSchedule,
      song: draft.song,
      isDraft: false,
      publishedAt: publishedSchedule.publishedAt,
      message: publishResult.shouldNotify
        ? notificationSent
          ? '排期发布成功，通知已发送'
          : '排期发布成功，但通知发送失败'
        : '排期发布成功'
    }
  } catch (error: any) {
    console.error('发布排期失败:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: error.message || '发布排期失败'
    })
  }
})
