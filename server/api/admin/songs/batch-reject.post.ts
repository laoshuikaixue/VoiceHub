import { db } from '~/drizzle/db'
import { schedules, songBlacklists, songs, votes, requestTimes } from '~/drizzle/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import { createSongRejectedNotification } from '../../../services/notificationService'

// 单次批量驳回的歌曲数量上限
const MAX_BATCH_REJECT_COUNT = 1000

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const body = await readBody(event)

  // 去重并过滤非法 ID
  const songIds = Array.isArray(body?.songIds)
    ? [...new Set(body.songIds.filter((id) => Number.isInteger(id) && id > 0))]
    : []
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const addToBlacklist = body?.addToBlacklist === true

  if (songIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: '歌曲ID列表不能为空'
    })
  }

  if (songIds.length > MAX_BATCH_REJECT_COUNT) {
    throw createError({
      statusCode: 400,
      message: `单次最多驳回 ${MAX_BATCH_REJECT_COUNT} 首歌曲`
    })
  }

  if (!reason) {
    throw createError({
      statusCode: 400,
      message: '驳回原因不能为空'
    })
  }

  try {
    let rejectedSongs = []

    // 使用事务确保批量驳回操作的原子性
    await db.transaction(async (tx) => {
      // 在事务中重新检查歌曲是否存在
      const existingSongs = await tx.select().from(songs).where(inArray(songs.id, songIds))

      if (existingSongs.length === 0) {
        throw createError({
          statusCode: 404,
          message: '歌曲不存在或已被删除'
        })
      }

      const existingIds = existingSongs.map((song) => song.id)
      console.log(`开始批量驳回歌曲，共 ${existingIds.length} 首`)

      // 如果选择加入黑名单，逐首添加（同名同歌手可能已存在，失败忽略）
      if (addToBlacklist) {
        for (const song of existingSongs) {
          try {
            await tx.insert(songBlacklists).values({
              type: 'SONG',
              value: `${song.title} - ${song.artist}`,
              reason: `歌曲驳回: ${reason}`,
              createdBy: user.id
            })
          } catch (error) {
            console.log(`黑名单添加失败，可能已存在: ${error.message}`)
          }
        }
        console.log(`黑名单添加处理完成`)
      }

      // 批量删除歌曲的所有投票
      await tx.delete(votes).where(inArray(votes.songId, existingIds))
      console.log(`删除了投票记录`)

      // 批量删除歌曲的所有排期
      await tx.delete(schedules).where(inArray(schedules.songId, existingIds))
      console.log(`删除了排期记录`)

      // 按 hitRequestId 分组，一次性减少对应时段的已接纳数量
      const hitRequestIds = [...new Set(existingSongs.map((song) => song.hitRequestId).filter(Boolean))]
      for (const hitRequestId of hitRequestIds) {
        const count = existingSongs.filter((song) => song.hitRequestId === hitRequestId).length
        try {
          await tx
            .update(requestTimes)
            .set({
              accepted: sql`GREATEST(0, accepted - ${count})`
            })
            .where(eq(requestTimes.id, hitRequestId))
        } catch (error) {
          console.error(`减少投稿时段 ${hitRequestId} 接纳数量失败: ${error.message}`)
        }
      }

      // 批量删除歌曲
      rejectedSongs = await tx.delete(songs).where(inArray(songs.id, existingIds)).returning()
      console.log(`歌曲批量删除完成`)
    })

    // 事务提交后，逐首发送驳回通知（异步，不阻塞响应）
    const songsToNotify = rejectedSongs.filter((song) => song.requesterId)
    for (const song of songsToNotify) {
      createSongRejectedNotification(
        song.requesterId,
        { title: song.title, artist: song.artist },
        reason
      ).catch((error) => {
        console.error(`发送驳回通知失败: ${error.message}`)
      })
    }

    console.log(`批量驳回操作完成，共 ${rejectedSongs.length} 首`)

    return {
      success: true,
      message: '歌曲批量驳回成功',
      data: {
        rejected: rejectedSongs.length,
        missing: songIds.length - rejectedSongs.length,
        notificationSent: songsToNotify.length
      }
    }
  } catch (error) {
    console.error('批量驳回歌曲失败:', error)

    // 如果是我们抛出的错误，直接重新抛出
    if (error.statusCode) {
      throw error
    }

    // 其他错误
    throw createError({
      statusCode: 500,
      message: '批量驳回失败: ' + error.message
    })
  }
})
