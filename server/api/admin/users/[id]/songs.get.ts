import { db } from '~/drizzle/db'
import { users, songs, votes, schedules } from '~/drizzle/schema'
import { eq, desc, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 使用认证中间件提供的用户信息
    const currentUser = event.context.user
    if (!currentUser) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }

    // 检查是否为管理员、歌曲管理员或超级管理员
    const allowedRoles = ['ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(currentUser.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    // 获取用户ID
    const userId = parseInt(getRouterParam(event, 'id') as string)
    if (!userId || isNaN(userId)) {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的用户ID'
      })
    }

    // 验证用户是否存在
    const userResult = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      grade: users.grade,
      class: users.class
    }).from(users).where(eq(users.id, userId)).limit(1)
    
    const user = userResult[0]

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 获取用户投稿的歌曲
    const submittedSongs = await db.select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      createdAt: songs.createdAt,
      played: songs.played
    }).from(songs).where(eq(songs.requesterId, userId)).orderBy(desc(songs.createdAt))

    // 获取用户投票的歌曲
    const votedSongs = await db.select({
      id: votes.id,
      createdAt: votes.createdAt,
      songId: votes.songId,
      songTitle: songs.title,
      songArtist: songs.artist,
      songPlayed: songs.played,
      requesterName: users.name,
      requesterGrade: users.grade,
      requesterClass: users.class
    }).from(votes)
    .leftJoin(songs, eq(votes.songId, songs.id))
    .leftJoin(users, eq(songs.requesterId, users.id))
    .where(eq(votes.userId, userId))
    .orderBy(desc(votes.createdAt))

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        grade: user.grade,
        class: user.class
      },
      submittedSongs: submittedSongs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        createdAt: song.createdAt,
        played: song.played,
        scheduled: false, // TODO: 需要单独查询 schedules
        voteCount: 0 // TODO: 需要单独查询投票数
      })),
      votedSongs: votedSongs.map(vote => ({
        id: vote.songId,
        title: vote.songTitle,
        artist: vote.songArtist,
        played: vote.songPlayed,
        scheduled: false, // TODO: 需要单独查询 schedules
        voteCount: 0, // TODO: 需要单独查询投票数
        votedAt: vote.createdAt,
        requester: {
          name: vote.requesterName,
          grade: vote.requesterGrade,
          class: vote.requesterClass
        }
      }))
    }
  } catch (error) {
    console.error('获取用户歌曲信息失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误'
    })
  }
})