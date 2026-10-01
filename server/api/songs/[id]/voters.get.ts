import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users, votes } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { canReadSongs } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  try {
    // 权限：song.read（SONG_ADMIN 及以上）。
    // 说明：旧实现对 401/403 返回 SONG_* 专属错误码；收敛到内核三态后改用
    // COMMON_INSUFFICIENT_PERMISSION / AUTH_UNAUTHORIZED（客户端按 code 本地化，属有意变更）。
    await canReadSongs(event)

    // 获取歌曲ID
    const songId = parseInt(getRouterParam(event, 'id') || '0')

    if (!songId || isNaN(songId)) {
      throw createApiError(400, 'SONG_INVALID_ID', '无效的歌曲ID')
    }

    // 检查歌曲是否存在
    const songResult = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist
      })
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1)

    const song = songResult[0]

    if (!song) {
      throw createApiError(404, 'SONG_NOT_FOUND', '歌曲不存在')
    }

    // 获取投票人员列表
    const votesResult = await db
      .select({
        userId: votes.userId,
        createdAt: votes.createdAt,
        userName: users.name,
        username: users.username,
        grade: users.grade,
        class: users.class
      })
      .from(votes)
      .innerJoin(users, eq(votes.userId, users.id))
      .where(eq(votes.songId, songId))
      .orderBy(votes.createdAt)

    // 处理用户名显示逻辑，总是显示年级和班级信息
    const votersWithDisplayName = votesResult.map((vote) => {
      let displayName = vote.userName || vote.username

      // 如果有年级信息，添加年级和班级后缀
      if (vote.grade) {
        if (vote.class) {
          displayName = `${displayName}（${vote.grade} ${vote.class}）`
        } else {
          displayName = `${displayName}（${vote.grade}）`
        }
      }

      return {
        id: vote.userId,
        name: displayName,
        votedAt: vote.createdAt
      }
    })

    return {
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist
      },
      voters: votersWithDisplayName,
      totalVotes: votersWithDisplayName.length
    }
  } catch (error: any) {
    console.error('获取投票人员列表失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createApiError(500, 'SONG_FETCH_VOTERS_FAILED', '获取投票人员列表失败')
  }
})
