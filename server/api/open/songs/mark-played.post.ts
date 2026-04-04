import { db } from '~/drizzle/db'
import { createSongPlayedNotification } from '~~/server/services/notificationService'
import { CacheService } from '~~/server/services/cacheService'
import { songs, songReplayRequests } from '~/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let songIds: number[] = []

  if (body.songId) {
    songIds = [body.songId]
  } else if (body.songIds && Array.isArray(body.songIds)) {
    songIds = body.songIds
  }

  if (songIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID列表不能为空'
    })
  }

  // 检查是否是撤回操作
  const isUnmark = body.unmark === true

  // 构建更新条件：只更新状态不符合预期的歌曲
  // 如果是标记为已播放(!isUnmark)，则只更新 played = false 的歌曲
  // 如果是撤回(isUnmark)，则只更新 played = true 的歌曲
  const condition = !isUnmark
    ? and(inArray(songs.id, songIds), eq(songs.played, false))
    : and(inArray(songs.id, songIds), eq(songs.played, true))

  // 使用事务确保数据一致性
  const { updatedSongsResult, updatedSongIds } = await db.transaction(async (tx) => {
    // 更新歌曲状态
    const updatedSongsResult = await tx
      .update(songs)
      .set({
        played: !isUnmark,
        playedAt: isUnmark ? null : getBeijingTime()
      })
      .where(condition)
      .returning({ id: songs.id })

    // 获取实际更新的歌曲ID列表
    const updatedSongIds = updatedSongsResult.map(s => s.id)

    if (updatedSongIds.length > 0) {
      // 根据操作类型更新重播申请状态
      const targetStatus = !isUnmark ? 'PENDING' : 'FULFILLED'
      const newStatus = !isUnmark ? 'FULFILLED' : 'PENDING'

      const updatedRequests = await tx
        .update(songReplayRequests)
        .set({
          status: newStatus,
          updatedAt: new Date()
        })
        .where(
          and(inArray(songReplayRequests.songId, updatedSongIds), eq(songReplayRequests.status, targetStatus))
        )
        .returning({ id: songReplayRequests.id })

      if (updatedRequests.length > 0) {
        const logMessage = !isUnmark
          ? `将 ${updatedRequests.length} 个重播申请状态更新为 FULFILLED（歌曲已播放）`
          : `将 ${updatedRequests.length} 个重播申请状态恢复为 PENDING（撤回已播放）`
        console.log(logMessage)
      }
    }

    return { updatedSongsResult, updatedSongIds }
  })

  // 清除歌曲和排期相关缓存
  try {
    const cacheService = CacheService.getInstance()
    await cacheService.clearSongsCache()
    await cacheService.clearSchedulesCache()
  } catch (error) {
    console.error('清除缓存失败:', error)
  }

  // 如果是标记为已播放，则异步发送通知（不阻塞响应）
  if (!isUnmark && updatedSongIds.length > 0) {
    // 获取客户端IP地址
    const clientIP = getClientIP(event)

    // 异步发送通知，不等待完成
    setImmediate(() => {
      Promise.allSettled(updatedSongIds.map(songId => 
        createSongPlayedNotification(songId, clientIP).catch((err) => {
          console.error(`发送歌曲(${songId})已播放通知失败:`, err)
        })
      ))
    })
  }

  return {
    message: isUnmark ? '歌曲已成功撤回已播放状态' : '歌曲已成功标记为已播放',
    count: updatedSongsResult.length,
    updatedSongIds: updatedSongIds
  }
})
