import { db } from '~/drizzle/db'
import { cacheService } from '~~/server/services/cacheService'
import {
  schedules,
  songs,
  systemSettings,
  votes,
  songCollaborators,
  collaborationLogs,
  requestTimes
} from '~/drizzle/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getTimeRange, type LimitType } from '~~/server/utils/submissionLimit'
import { releaseCardCodeAfterSongWithdrawal } from '~~/server/services/cardCodeLifecycleService'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能撤回歌曲'
    })
  }

  const body = await readBody(event)

  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID不能为空'
    })
  }

  // 查找歌曲
  const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)
  const song = songResult[0]

  if (!song) {
    throw createError({
      statusCode: 404,
      message: '歌曲不存在'
    })
  }

  // 检查是否是用户自己的投稿或联合投稿
  const isRequester = song.requesterId === user.id
  let isCollaborator = false
  let collaboratorRecord = null

  if (!isRequester) {
    const collabResult = await db
      .select()
      .from(songCollaborators)
      .where(and(eq(songCollaborators.songId, song.id), eq(songCollaborators.userId, user.id)))
      .limit(1)

    if (collabResult.length > 0) {
      isCollaborator = true
      collaboratorRecord = collabResult[0]
    }
  }

  if (!isRequester && !isCollaborator && !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只能撤回自己的投稿或退出联合投稿'
    })
  }

  // 检查歌曲是否已经播放
  if (song.played) {
    throw createError({
      statusCode: 400,
      message: '已播放的歌曲不能撤回'
    })
  }

  // 检查歌曲是否已排期（只检查已发布的排期，草稿不算）
  const scheduleResult = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.songId, body.songId), eq(schedules.isDraft, false)))
    .limit(1)
  const schedule = scheduleResult[0]

  if (schedule) {
    throw createError({
      statusCode: 400,
      message: '已排期的歌曲不能撤回'
    })
  }

  // 如果是联合投稿人撤回（退出）
  if (isCollaborator && !isRequester && !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    await db.delete(songCollaborators).where(eq(songCollaborators.id, collaboratorRecord.id))

    // 记录日志
    await db.insert(collaborationLogs).values({
      collaboratorId: collaboratorRecord.id,
      action: 'LEAVE',
      operatorId: user.id,
      ipAddress:
        (event.node.req.headers['x-forwarded-for'] as string) || event.node.req.socket.remoteAddress
    })

    // 清除歌曲列表缓存
    await cacheService.clearSongsCache()

    return {
      message: '已成功退出联合投稿',
      songId: body.songId,
      action: 'leave'
    }
  }

  // 如果是主投稿人撤回（删除歌曲）
  // 获取系统设置以检查限制类型
  const settingsResult = await db.select().from(systemSettings).limit(1)
  const settings = settingsResult[0]
  const dailyLimit = settings?.dailySubmissionLimit || 0
  const weeklyLimit = settings?.weeklySubmissionLimit || 0
  const monthlyLimit = settings?.monthlySubmissionLimit || 0

  // 检查撤销的歌曲是否在当前限制期间内（用于返还配额）
  let canReturnQuota = false

  const limitConfigs: { type: LimitType; value: number }[] = [
    { type: 'daily', value: dailyLimit },
    { type: 'weekly', value: weeklyLimit },
    { type: 'monthly', value: monthlyLimit }
  ]

  for (const { type, value } of limitConfigs) {
    if (value > 0) {
      const { start, end } = getTimeRange(type)
      if (song.createdAt >= start && song.createdAt <= end) {
        canReturnQuota = true
        break
      }
    }
  }

  // 投稿关联数据一起进入事务，避免撤回失败时只删掉一部分数据。
  try {
    await db.transaction(async (tx) => {
      await tx.delete(songCollaborators).where(eq(songCollaborators.songId, body.songId))
      await tx.delete(votes).where(eq(votes.songId, body.songId))

      if (song.hitRequestId) {
        await tx
          .update(requestTimes)
          .set({
            accepted: sql`GREATEST(0, accepted - 1)`
          })
          .where(eq(requestTimes.id, song.hitRequestId))
        console.log(`已减少投稿时段 ${song.hitRequestId} 的接纳数量`)
      }

      if (song.cardCodeId) {
        const releaseResult = await releaseCardCodeAfterSongWithdrawal(tx, {
          songId: song.id,
          cardCodeId: song.cardCodeId,
          operatorId: user.id
        })
        if (
          !releaseResult.changed &&
          ['CONCURRENT_CHANGE', 'MISSING_CARD_CODE'].includes(String(releaseResult.reason || ''))
        ) {
          throw createError({ statusCode: 409, message: '点歌券释放失败，撤回已终止' })
        }
      }

      // 删除歌曲（在事务内）
      await tx.delete(songs).where(eq(songs.id, body.songId))
    })
  } catch (txErr: any) {
    console.error('撤回事务失败:', txErr)
    throw createError({ statusCode: txErr.statusCode || 500, message: txErr.message || '撤回歌曲失败，请稍后重试' })
  }

  // 清除歌曲列表缓存
  await cacheService.clearSongsCache()
  console.log('[Cache] 歌曲缓存已清除（撤回歌曲）')

  return {
    message: canReturnQuota ? '歌曲已成功撤回，投稿配额已返还' : '歌曲已成功撤回',
    songId: body.songId,
    quotaReturned: canReturnQuota
  }
})
