import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users, votes } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 检查用户认证
    const user = event.context.user

    if (!user) {
      throw createError({
        statusCode: 401,
        message: '需要登录才能查看投票人员'
      })
    }

    // 检查管理员权限
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '只有管理员才能查看投票人员列表'
      })
    }

    // 获取歌曲ID
    const songId = parseInt(getRouterParam(event, 'id') || '0')

    if (!songId || isNaN(songId)) {
      throw createError({
        statusCode: 400,
        message: '无效的歌曲ID'
      })
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
      throw createError({
        statusCode: 404,
        message: '歌曲不存在'
      })
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

    throw createError({
      statusCode: 500,
      message: '获取投票人员列表失败'
    })
  }
})
