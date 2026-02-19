import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songs, users, votes, songReplayRequests } from '~/drizzle/schema'
import { count, desc, eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const query = getQuery(event)
  const semester = query.semester as string
  const limit = parseInt(query.limit as string) || 10
  const sortBy = (query.sortBy as string) || 'vote'

  try {
    let topSongs

    if (sortBy === 'replay') {
      // 按重播次数排行
      topSongs = await db
        .select({
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          requesterName: users.name,
          requesterUsername: users.username,
          count: count(songReplayRequests.id)
        })
        .from(songs)
        .leftJoin(users, eq(songs.requesterId, users.id))
        .leftJoin(songReplayRequests, eq(songs.id, songReplayRequests.songId))
        .where(semester && semester !== 'all' ? eq(songs.semester, semester) : sql`1=1`)
        .groupBy(songs.id, songs.title, songs.artist, users.name, users.username)
        .orderBy(desc(count(songReplayRequests.id)))
        .limit(limit)
    } else {
      // 按投票数排行（默认）
      topSongs = await db
        .select({
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          requesterName: users.name,
          requesterUsername: users.username,
          count: count(votes.id)
        })
        .from(songs)
        .leftJoin(users, eq(songs.requesterId, users.id))
        .leftJoin(votes, eq(songs.id, votes.songId))
        .where(semester && semester !== 'all' ? eq(songs.semester, semester) : sql`1=1`)
        .groupBy(songs.id, songs.title, songs.artist, users.name, users.username)
        .orderBy(desc(count(votes.id)))
        .limit(limit)
    }

    // 格式化数据
    const formattedData = topSongs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      count: Number(song.count),
      requester: song.requesterName || song.requesterUsername || '未知用户'
    }))

    return formattedData
  } catch (error) {
    console.error('获取热门歌曲排行失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取热门歌曲排行失败'
    })
  }
})
