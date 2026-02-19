import { db } from '~/drizzle/db'
import { playTimes, schedules, songs, songReplayRequests } from '~/drizzle/schema'
import { and, eq, gte, lte, inArray } from 'drizzle-orm'
import { createSongSelectedNotification } from '~~/server/services/notificationService'
import { cacheService } from '~~/server/services/cacheService'
import { getClientIP } from '~~/server/utils/ip-utils'

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

  // 验证必要参数
  if (!body.playDate || !body.songs || !Array.isArray(body.songs)) {
    throw createError({
      statusCode: 400,
      message: '参数无效：需要 playDate 和 songs 数组'
    })
  }

  const clientIP = getClientIP(event)
  const startTime = Date.now()

  try {
    // 解析日期
    const inputDateStr =
      typeof body.playDate === 'string' ? body.playDate : body.playDate.toISOString()
    // 确保使用当天的开始时间（UTC）
    const playDate = new Date(inputDateStr + 'T00:00:00.000Z')
    const startOfDay = new Date(inputDateStr + 'T00:00:00.000Z')
    const endOfDay = new Date(inputDateStr + 'T23:59:59.999Z')
    const playTimeId = body.playTimeId ? parseInt(body.playTimeId) : null

    // 获取所有涉及的歌曲详情（用于通知）
    const songIds = body.songs.map((s: any) => s.songId)
    if (songIds.length === 0) {
      // 如果列表为空，说明是清空排期，直接执行删除逻辑即可
    }

    const songDetails =
      songIds.length > 0 ? await db.select().from(songs).where(inArray(songs.id, songIds)) : []

    const songMap = new Map(songDetails.map((s: any) => [s.id, s]))

    // 需要发送通知的列表
    const notificationsToSend: Array<{
      requesterId: number
      songId: number
      songInfo: { title: string; artist: string; playDate: Date }
    }> = []

    // 开始事务
    await db.transaction(async (tx) => {
      // 1. 构建查询条件：指定日期 + (可选)指定时段
      const whereConditions = [
        gte(schedules.playDate, startOfDay),
        lte(schedules.playDate, endOfDay)
      ]

      if (playTimeId) {
        whereConditions.push(eq(schedules.playTimeId, playTimeId))
      }

      // 2. 查找该时间段内已发布的排期（用于避免重复发送通知）
      const existingPublished = await tx
        .select({
          songId: schedules.songId
        })
        .from(schedules)
        .where(and(...whereConditions, eq(schedules.isDraft, false)))

      const existingPublishedSongIds = new Set(existingPublished.map((s) => s.songId))

      // 3. 删除该时间段内的所有排期（包括草稿和已发布）
      await tx.delete(schedules).where(and(...whereConditions))

      // 4. 插入新的排期并处理通知
      const publishedAt = new Date()

      for (const item of body.songs) {
        const song = songMap.get(item.songId)
        if (!song) {
          console.warn(`找不到歌曲 ID: ${item.songId}，跳过排期`)
          continue
        }

        // 插入排期
        await tx.insert(schedules).values({
          songId: item.songId,
          playDate: playDate,
          sequence: item.sequence,
          playTimeId: playTimeId,
          isDraft: false, // 直接发布
          publishedAt: publishedAt,
          updatedAt: publishedAt
        })

        // 如果该歌曲之前未在此时间段发布过，则发送通知并更新重播状态
        if (!existingPublishedSongIds.has(item.songId)) {
          // 添加到通知列表，稍后发送
          notificationsToSend.push({
            requesterId: song.requesterId,
            songId: song.id,
            songInfo: {
              title: song.title,
              artist: song.artist,
              playDate: playDate
            }
          })

          // 更新重播申请状态
          await tx
            .update(songReplayRequests)
            .set({ status: 'FULFILLED' })
            .where(
              and(eq(songReplayRequests.songId, song.id), eq(songReplayRequests.status, 'PENDING'))
            )
        }
      }
    })

    // 事务成功提交后，清除缓存
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache()
      console.log(`[Cache] 排期缓存和歌曲列表缓存已清除（批量发布排期）`)
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }

    // 异步发送通知（不阻塞响应）
    Promise.allSettled(
      notificationsToSend.map((n) =>
        createSongSelectedNotification(n.requesterId, n.songId, n.songInfo, clientIP)
      )
    )
      .then((results) => {
        const successCount = results.filter((r) => r.status === 'fulfilled').length
        console.log(
          `[Notification] 批量发布通知发送完成: ${successCount}/${notificationsToSend.length} 成功`
        )
      })
      .catch((err) => {
        console.error('[Notification] 批量发送通知时发生未捕获错误:', err)
      })

    console.log(`[Performance] 批量发布排期耗时: ${Date.now() - startTime}ms`)

    return {
      success: true,
      message: '排期发布成功'
    }
  } catch (error: any) {
    console.error('批量发布排期失败:', {
      error: error.message,
      stack: error.stack,
      userId: user.id,
      ip: clientIP
    })

    throw createError({
      statusCode: 500,
      message: error.message || '发布排期失败'
    })
  }
})
