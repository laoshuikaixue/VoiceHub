import { db } from '~/drizzle/db'
import { schedules, songReplayRequests, songs, users, votes } from '~/drizzle/schema'
import { and, count, desc, eq, inArray } from 'drizzle-orm'

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
    const userResult = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        grade: users.grade,
        class: users.class
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const user = userResult[0]

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 获取用户投稿的歌曲
    const submittedSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        semester: songs.semester,
        createdAt: songs.createdAt,
        played: songs.played
      })
      .from(songs)
      .where(eq(songs.requesterId, userId))
      .orderBy(desc(songs.createdAt))

    // 获取投稿歌曲的投票数
    const submittedSongIds = submittedSongs.map((song) => song.id)
    const submittedVoteCountsMap = new Map()
    if (submittedSongIds.length > 0) {
      const submittedVoteCountsResult = await db
        .select({
          songId: votes.songId,
          voteCount: count(votes.id)
        })
        .from(votes)
        .where(inArray(votes.songId, submittedSongIds))
        .groupBy(votes.songId)

      submittedVoteCountsResult.forEach((item) => {
        submittedVoteCountsMap.set(item.songId, item.voteCount)
      })
    }

    // 获取用户投票的歌曲
    const votedSongs = await db
      .select({
        id: votes.id,
        createdAt: votes.createdAt,
        songId: votes.songId,
        songTitle: songs.title,
        songArtist: songs.artist,
        songSemester: songs.semester,
        songPlayed: songs.played,
        requesterName: users.name,
        requesterGrade: users.grade,
        requesterClass: users.class
      })
      .from(votes)
      .leftJoin(songs, eq(votes.songId, songs.id))
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(eq(votes.userId, userId))
      .orderBy(desc(votes.createdAt))

    // 获取投票歌曲的投票数
    const votedSongIds = votedSongs.map((vote) => vote.songId).filter((id) => id !== null)
    const votedVoteCountsMap = new Map()
    if (votedSongIds.length > 0) {
      const votedVoteCountsResult = await db
        .select({
          songId: votes.songId,
          voteCount: count(votes.id)
        })
        .from(votes)
        .where(inArray(votes.songId, votedSongIds))
        .groupBy(votes.songId)

      votedVoteCountsResult.forEach((item) => {
        votedVoteCountsMap.set(item.songId, item.voteCount)
      })
    }

    // 获取投稿歌曲的排期状态
    // 只查询已发布的排期，草稿不算作已排期
    const submittedScheduleMap = new Map()
    if (submittedSongIds.length > 0) {
      const submittedScheduleResult = await db
        .select({
          songId: schedules.songId
        })
        .from(schedules)
        .where(and(inArray(schedules.songId, submittedSongIds), eq(schedules.isDraft, false)))

      submittedScheduleResult.forEach((item) => {
        submittedScheduleMap.set(item.songId, true)
      })
    }

    // 获取投票歌曲的排期状态
    // 只查询已发布的排期，草稿不算作已排期
    const votedScheduleMap = new Map()
    if (votedSongIds.length > 0) {
      const votedScheduleResult = await db
        .select({
          songId: schedules.songId
        })
        .from(schedules)
        .where(and(inArray(schedules.songId, votedSongIds), eq(schedules.isDraft, false)))

      votedScheduleResult.forEach((item) => {
        votedScheduleMap.set(item.songId, true)
      })
    }

    // 获取用户申请重播的歌曲
    const replayRequestedSongs = await db
      .select({
        id: songReplayRequests.id,
        createdAt: songReplayRequests.createdAt,
        songId: songReplayRequests.songId,
        songTitle: songs.title,
        songArtist: songs.artist,
        songSemester: songs.semester,
        songPlayed: songs.played,
        requesterName: users.name,
        requesterGrade: users.grade,
        requesterClass: users.class
      })
      .from(songReplayRequests)
      .leftJoin(songs, eq(songReplayRequests.songId, songs.id))
      .leftJoin(users, eq(songs.requesterId, users.id))
      .where(eq(songReplayRequests.userId, userId))
      .orderBy(desc(songReplayRequests.createdAt))

    // 获取重播申请歌曲的总申请数
    const replaySongIds = replayRequestedSongs.map((req) => req.songId).filter((id) => id !== null)
    const replayRequestCountsMap = new Map()
    if (replaySongIds.length > 0) {
      const replayRequestCountsResult = await db
        .select({
          songId: songReplayRequests.songId,
          requestCount: count(songReplayRequests.id)
        })
        .from(songReplayRequests)
        .where(inArray(songReplayRequests.songId, replaySongIds))
        .groupBy(songReplayRequests.songId)

      replayRequestCountsResult.forEach((item) => {
        replayRequestCountsMap.set(item.songId, item.requestCount)
      })
    }

    // 获取重播申请歌曲的排期状态
    const replayScheduleMap = new Map()
    if (replaySongIds.length > 0) {
      const replayScheduleResult = await db
        .select({
          songId: schedules.songId
        })
        .from(schedules)
        .where(and(inArray(schedules.songId, replaySongIds), eq(schedules.isDraft, false)))

      replayScheduleResult.forEach((item) => {
        replayScheduleMap.set(item.songId, true)
      })
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        grade: user.grade,
        class: user.class
      },
      submittedSongs: submittedSongs.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        semester: song.semester,
        createdAt: song.createdAt,
        played: song.played,
        scheduled: submittedScheduleMap.has(song.id),
        voteCount: submittedVoteCountsMap.get(song.id) || 0
      })),
      votedSongs: votedSongs.map((vote) => ({
        id: vote.songId,
        title: vote.songTitle,
        artist: vote.songArtist,
        semester: vote.songSemester,
        played: vote.songPlayed,
        scheduled: votedScheduleMap.has(vote.songId),
        voteCount: votedVoteCountsMap.get(vote.songId) || 0,
        votedAt: vote.createdAt,
        requester: {
          name: vote.requesterName,
          grade: vote.requesterGrade,
          class: vote.requesterClass
        }
      })),
      replayRequestedSongs: replayRequestedSongs.map((req) => ({
        id: req.songId,
        title: req.songTitle,
        artist: req.songArtist,
        semester: req.songSemester,
        played: req.songPlayed,
        scheduled: replayScheduleMap.has(req.songId),
        requestCount: replayRequestCountsMap.get(req.songId) || 0,
        requestedAt: req.createdAt,
        requester: {
          name: req.requesterName,
          grade: req.requesterGrade,
          class: req.requesterClass
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
