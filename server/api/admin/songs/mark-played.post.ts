import { db } from '~/drizzle/db'
import { createSongPlayedNotification } from '~~/server/services/notificationService'
import { CacheService } from '~~/server/services/cacheService'
import { songs, songReplayRequests } from '~/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { getClientIP } from '~~/server/utils/ip-utils'
import { z } from 'zod'

const markPlayedSchema = z.object({
  songId: z.number().optional(),
  songIds: z.array(z.number()).max(100, '批量操作单次最多支持 100 首歌曲').optional(),
  unmark: z.boolean().optional()
})

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
  const validatedDataResult = markPlayedSchema.safeParse(body)

  if (!validatedDataResult.success) {
    throw createError({
      statusCode: 400,
      message: validatedDataResult.error.issues[0]?.message || '请求参数无效'
    })
  }

  const validatedData = validatedDataResult.data

  const songIds = Array.from(new Set([
    ...(validatedData.songId !== undefined ? [validatedData.songId] : []),
    ...(validatedData.songIds || [])
  ]))

  if (songIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID列表不能为空'
    })
  }

  // 撤回已播放
  const isUnmark = validatedData.unmark === true

  // 过滤需要更新的歌曲
  const condition = !isUnmark
    ? and(inArray(songs.id, songIds), eq(songs.played, false))
    : and(inArray(songs.id, songIds), eq(songs.played, true))

  const { updatedSongsResult, updatedSongIds } = await db.transaction(async (tx) => {
    const updatedSongsResult = await tx
      .update(songs)
      .set({
        played: !isUnmark,
        playedAt: isUnmark ? null : getBeijingTime()
      })
      .where(condition)
      .returning({ id: songs.id })

    const updatedSongIds = updatedSongsResult.map(s => s.id)

    if (updatedSongIds.length > 0) {
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

  // 清理缓存
  if (updatedSongIds.length > 0) {
    try {
      const cacheService = CacheService.getInstance()
      await cacheService.clearSongsCache()
      await cacheService.clearSchedulesCache()
    } catch (error) {
      console.error('清除缓存失败:', error)
    }
  }

  // 异步发送通知
  if (!isUnmark && updatedSongIds.length > 0) {
    const clientIP = getClientIP(event)

    event.waitUntil(
      Promise.allSettled(updatedSongIds.map(songId =>
        createSongPlayedNotification(songId, clientIP).catch((err) => {
          console.error(`发送歌曲(${songId})已播放通知失败:`, err)
        })
      ))
    )
  }

  return {
    message: isUnmark ? '歌曲已成功撤回已播放状态' : '歌曲已成功标记为已播放',
    count: updatedSongsResult.length,
    updatedSongIds: updatedSongIds
  }
})
