import { db } from '~/drizzle/db'
import { schedules, songs, votes } from '~/drizzle/schema'
import { and, count, eq } from 'drizzle-orm'
import { createSongVotedNotification } from '../../services/notificationService'
import {
  isSongProtected,
  getSongProtectRemainingSeconds,
  recordSongVote,
  recordUserVoteActivity
} from '~~/server/services/securityService'
import { cacheService } from '~~/server/services/cacheService'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能投票'
    })
  }

  const body = await readBody(event)
  const clientIP = getClientIP(event)

  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID不能为空'
    })
  }

  const isUnvote = body.unvote === true

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

    // 检查歌曲是否已播放
    if (song.played) {
      throw createError({
        statusCode: 400,
        message: '该歌曲已播放，无法进行投票操作'
      })
    }

    // 检查歌曲是否已排期（只检查已发布的排期，草稿不算）
    const schedulesResult = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.songId, body.songId), eq(schedules.isDraft, false)))
      .limit(1)

    if (schedulesResult.length > 0) {
      throw createError({
        statusCode: 400,
        message: '该歌曲已排期，无法进行投票操作'
      })
    }

    // 检查是否是自己的歌曲
    if (song.requesterId === user.id) {
      throw createError({
        statusCode: 400,
        message: '不允许自己给自己投票'
      })
    }

    if (isSongProtected(body.songId)) {
      const remain = getSongProtectRemainingSeconds(body.songId)
      throw createError({
        statusCode: 423,
        message: `该歌曲处于临时保护期，剩余 ${Math.max(remain, 1)} 秒`
      })
    }

    // 检查用户是否已经投过票
    const existingVoteResult = await db
      .select()
      .from(votes)
      .where(and(eq(votes.songId, body.songId), eq(votes.userId, user.id)))
      .limit(1)

    const existingVote = existingVoteResult[0]

    if (isUnvote) {
      // 撤销投票逻辑
      if (!existingVote) {
        throw createError({
          statusCode: 400,
          message: '你尚未为这首歌投票，无法取消'
        })
      }

      // 删除投票
      await db.delete(votes).where(eq(votes.id, existingVote.id))

      // 获取投票总数
      const voteCountResult = await db
        .select({ count: count() })
        .from(votes)
        .where(eq(votes.songId, body.songId))

      const voteCount = voteCountResult[0].count

      // 清除统计缓存和歌曲缓存
      try {
        await cacheService.clearStatsCache()
        await cacheService.clearSongsCache()
        console.log('[Cache] 统计缓存和歌曲缓存已清除（取消投票）')
      } catch (cacheError) {
        console.error('[Cache] 缓存清除失败（取消投票）:', cacheError)
      }

      return {
        success: true,
        message: '取消投票成功',
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          voteCount
        }
      }
    } else {
      // 正常投票逻辑
      if (existingVote) {
        throw createError({
          statusCode: 400,
          message: '你已经为这首歌投过票了'
        })
      }

      // 创建新的投票
      const newVote = await db
        .insert(votes)
        .values({
          songId: body.songId,
          userId: user.id
        })
        .returning()

      // 获取投票总数
      const voteCountResult = await db
        .select({ count: count() })
        .from(votes)
        .where(eq(votes.songId, body.songId))

      const voteCount = voteCountResult[0].count

      // 发送通知（异步，不阻塞响应）
      if (song.requesterId !== user.id) {
        createSongVotedNotification(body.songId, user.id, clientIP).catch(() => {
          // 发送通知失败不影响主流程
        })
      }

      const protectedTriggered = recordSongVote(body.songId, clientIP, user.id)
      recordUserVoteActivity(user.id, song.title)

      // 清除统计缓存和歌曲缓存
      try {
        await cacheService.clearStatsCache()
        await cacheService.clearSongsCache()
        console.log('[Cache] 统计缓存和歌曲缓存已清除（投票）')
      } catch (cacheError) {
        console.error('[Cache] 缓存清除失败（投票）:', cacheError)
      }

      return {
        success: true,
        message: '投票成功',
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          voteCount
        }
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    } else {
      throw createError({
        statusCode: 500,
        message: '操作失败，请稍后重试'
      })
    }
  }
})
