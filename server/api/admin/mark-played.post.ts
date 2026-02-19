import { db } from '~/drizzle/db'
import { createSongPlayedNotification } from '../../services/notificationService'
import { CacheService } from '~~/server/services/cacheService'
import { songs, songReplayRequests } from '~/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能标记歌曲'
    })
  }

  // 检查是否是管理员
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员可以标记歌曲为已播放'
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

  // 检查是否是撤回操作
  const isUnmark = body.unmark === true

  // 检查歌曲播放状态
  if (!isUnmark && song.played) {
    throw createError({
      statusCode: 400,
      message: '歌曲已经标记为已播放'
    })
  } else if (isUnmark && !song.played) {
    throw createError({
      statusCode: 400,
      message: '歌曲尚未标记为已播放'
    })
  }

  // 更新歌曲状态
  const updatedSongResult = await db
    .update(songs)
    .set({
      played: !isUnmark,
      playedAt: isUnmark ? null : getBeijingTime()
    })
    .where(eq(songs.id, body.songId))
    .returning()
  const updatedSong = updatedSongResult[0]

  // 如果是标记为已播放，更新相关的重播申请状态为 FULFILLED
  if (!isUnmark) {
    const updatedRequests = await db
      .update(songReplayRequests)
      .set({
        status: 'FULFILLED',
        updatedAt: new Date()
      })
      .where(
        and(eq(songReplayRequests.songId, body.songId), eq(songReplayRequests.status, 'PENDING'))
      )
      .returning()

    if (updatedRequests.length > 0) {
      console.log(`将 ${updatedRequests.length} 个重播申请状态更新为 FULFILLED（歌曲已播放）`)
    }
  }
  // 如果是撤回已播放状态，将 FULFILLED 的重播申请恢复为 PENDING
  else {
    const restoredRequests = await db
      .update(songReplayRequests)
      .set({
        status: 'PENDING',
        updatedAt: new Date()
      })
      .where(
        and(eq(songReplayRequests.songId, body.songId), eq(songReplayRequests.status, 'FULFILLED'))
      )
      .returning()

    if (restoredRequests.length > 0) {
      console.log(`将 ${restoredRequests.length} 个重播申请状态恢复为 PENDING（撤回已播放）`)
    }
  }

  // 清除歌曲相关缓存
  try {
    const cacheService = CacheService.getInstance()
    await cacheService.clearSongsCache()
  } catch (error) {
    console.error('清除歌曲缓存失败:', error)
  }

  // 如果是标记为已播放，则发送通知
  if (!isUnmark) {
    // 获取客户端IP地址
    const clientIP = getClientIP(event)

    createSongPlayedNotification(body.songId, clientIP).catch((err) => {
      console.error('发送歌曲已播放通知失败:', err)
    })
  }

  return {
    message: isUnmark ? '歌曲已成功撤回已播放状态' : '歌曲已成功标记为已播放',
    song: {
      id: updatedSong.id,
      title: updatedSong.title,
      artist: updatedSong.artist,
      played: updatedSong.played,
      playedAt: updatedSong.playedAt
    }
  }
})
