import { db } from '~/drizzle/db'
import {
  schedules,
  songs,
  votes,
  songCollaborators,
  collaborationLogs,
  requestTimes
} from '~/drizzle/schema'
import { and, eq, sql } from 'drizzle-orm'
import { releaseCardCodeAfterSongWithdrawal } from '~~/server/services/cardCodeLifecycleService'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import { executeSongWithdrawal } from '~~/server/services/songQuotaService'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { getServerDate } from '~~/server/utils/serverTime'

const SONG_QUOTA_PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

const resolveSongQuotaPeriodType = (value: unknown) =>
  SONG_QUOTA_PERIOD_TYPES.includes(value as (typeof SONG_QUOTA_PERIOD_TYPES)[number])
    ? (value as (typeof SONG_QUOTA_PERIOD_TYPES)[number])
    : 'DAILY'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createApiError(401, 'SONG_LOGIN_REQUIRED_WITHDRAW', '需要登录才能撤回歌曲')
  }

  const body = await readBody(event)

  if (!body.songId) {
    throw createApiError(400, 'SONG_ID_REQUIRED', '歌曲ID不能为空')
  }

  // 查找歌曲
  const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)
  const song = songResult[0]

  if (!song) {
    throw createApiError(404, 'SONG_NOT_FOUND', '歌曲不存在')
  }

  // 检查是否是用户自己的投稿或联合投稿
  const isRequester = song.requesterId === user.id
  let isCollaborator = false

  if (!isRequester) {
    const collabResult = await db
      .select()
      .from(songCollaborators)
      .where(and(eq(songCollaborators.songId, song.id), eq(songCollaborators.userId, user.id)))
      .limit(1)

    if (collabResult.length > 0) {
      isCollaborator = true
    }
  }

  if (
    !isRequester &&
    !isCollaborator &&
    !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)
  ) {
    throw createApiError(403, 'SONG_WITHDRAW_OWN_ONLY', '只能撤回自己的投稿或退出联合投稿')
  }

  // 检查歌曲是否已经播放
  if (song.played) {
    throw createApiError(400, 'SONG_PLAYED_CANNOT_WITHDRAW', '已播放的歌曲不能撤回')
  }

  // 检查歌曲是否已排期（只检查已发布的排期，草稿不算）
  const scheduleResult = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.songId, body.songId), eq(schedules.isDraft, false)))
    .limit(1)
  const schedule = scheduleResult[0]

  if (schedule) {
    throw createApiError(400, 'SONG_SCHEDULED_CANNOT_WITHDRAW', '已排期的歌曲不能撤回')
  }

  // 如果是联合投稿人撤回（退出）
  if (
    isCollaborator &&
    !isRequester &&
    !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)
  ) {
    await db.transaction(async (tx) => {
      const lockedSongs = await tx
        .select()
        .from(songs)
        .where(eq(songs.id, body.songId))
        .limit(1)
        .for('update')
      const lockedSong = lockedSongs[0]
      if (!lockedSong) {
        throw createApiError(404, 'SONG_NOT_FOUND', '歌曲不存在')
      }

      const lockedCollaborators = await tx
        .select()
        .from(songCollaborators)
        .where(
          and(eq(songCollaborators.songId, lockedSong.id), eq(songCollaborators.userId, user.id))
        )
        .limit(1)
      const lockedCollaborator = lockedCollaborators[0]
      if (lockedSong.requesterId === user.id || !lockedCollaborator) {
        throw createApiError(403, 'SONG_WITHDRAW_OWN_ONLY', '只能撤回自己的投稿或退出联合投稿')
      }
      if (lockedSong.played) {
        throw createApiError(400, 'SONG_PLAYED_CANNOT_WITHDRAW', '已播放的歌曲不能撤回')
      }

      const publishedSchedules = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(and(eq(schedules.songId, lockedSong.id), eq(schedules.isDraft, false)))
        .limit(1)
      if (publishedSchedules.length > 0) {
        throw createApiError(400, 'SONG_SCHEDULED_CANNOT_WITHDRAW', '已排期的歌曲不能撤回')
      }

      await tx.delete(songCollaborators).where(eq(songCollaborators.id, lockedCollaborator.id))
      await tx.insert(collaborationLogs).values({
        collaboratorId: lockedCollaborator.id,
        action: 'LEAVE',
        operatorId: user.id,
        ipAddress:
          (event.node.req.headers['x-forwarded-for'] as string) ||
          event.node.req.socket.remoteAddress
      })
    })

    return {
      message: '已成功退出联合投稿',
      songId: body.songId,
      action: 'leave'
    }
  }

  const settings = await getSystemSettingsCached()
  const quotaSettings = {
    songQuotaEnabled: settings?.songQuotaEnabled === true,
    songQuotaPeriodType: resolveSongQuotaPeriodType(settings?.songQuotaPeriodType),
    songQuotaPeriodAmount: settings?.songQuotaPeriodAmount || 1,
    adminSongQuotaExempt: settings?.adminSongQuotaExempt !== false,
    blockOnSongQuotaInsufficient: settings?.blockOnSongQuotaInsufficient !== false
  }
  const withdrawalResult = await db
    .transaction(async (tx) => {
      const now = getServerDate()
      return await executeSongWithdrawal(createSongQuotaDrizzleAdapter(tx), {
        songId: body.songId,
        operatorId: user.id,
        settings: quotaSettings,
        now,
        validateLockedSong: async (lockedSong) => {
          const lockedIsRequester = lockedSong.requesterId === user.id
          let lockedIsCollaborator = false
          if (!lockedIsRequester) {
            const rows = await tx
              .select({ id: songCollaborators.id })
              .from(songCollaborators)
              .where(
                and(
                  eq(songCollaborators.songId, lockedSong.id),
                  eq(songCollaborators.userId, user.id)
                )
              )
              .limit(1)
            lockedIsCollaborator = rows.length > 0
          }
          if (
            !lockedIsRequester &&
            !lockedIsCollaborator &&
            !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)
          ) {
            throw createApiError(403, 'SONG_WITHDRAW_OWN_ONLY', '只能撤回自己的投稿或退出联合投稿')
          }
          if (lockedSong.played) {
            throw createApiError(400, 'SONG_PLAYED_CANNOT_WITHDRAW', '已播放的歌曲不能撤回')
          }
          const publishedSchedules = await tx
            .select({ id: schedules.id })
            .from(schedules)
            .where(and(eq(schedules.songId, lockedSong.id), eq(schedules.isDraft, false)))
            .limit(1)
          if (publishedSchedules.length > 0) {
            throw createApiError(400, 'SONG_SCHEDULED_CANNOT_WITHDRAW', '已排期的歌曲不能撤回')
          }
        },
        releaseLegacyCard: async (input) =>
          releaseCardCodeAfterSongWithdrawal(tx, { ...input, at: input.now }),
        deleteDraftSchedules: async (lockedSong) => {
          await tx
            .delete(schedules)
            .where(and(eq(schedules.songId, lockedSong.id), eq(schedules.isDraft, true)))
        },
        deleteSongRelations: async (lockedSong) => {
          await tx.delete(songCollaborators).where(eq(songCollaborators.songId, lockedSong.id))
          await tx.delete(votes).where(eq(votes.songId, lockedSong.id))
        },
        decrementRequestTime: async (lockedSong) => {
          if (!lockedSong.hitRequestId) return
          await tx
            .update(requestTimes)
            .set({ accepted: sql`GREATEST(0, accepted - 1)` })
            .where(eq(requestTimes.id, lockedSong.hitRequestId))
        },
        deleteSong: async (lockedSong) => {
          await tx.delete(songs).where(eq(songs.id, lockedSong.id))
        }
      })
    })
    .catch((txErr: any) => {
      console.error('撤回事务失败:', txErr)
      if (txErr?.data?.code || txErr?.statusCode) throw txErr
      throw createApiError(500, 'SONG_OPERATION_FAILED', '撤回歌曲失败，请稍后重试')
    })

  const { quotaReturnResult } = withdrawalResult

  return {
    message: quotaReturnResult === 'RETURNED' ? '歌曲已成功撤回，投稿配额已返还' : '歌曲已成功撤回',
    songId: body.songId,
    quotaReturnResult
  }
})
