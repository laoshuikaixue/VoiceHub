import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { songs, votes } from '~/drizzle/schema'
import { and, asc, count, desc, eq, gte, lt, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户是否登录
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '请先登录'
    })
  }

  const userId = user.id

  // 筛选当前年份
  const currentYear = 2025
  const startOfYear = new Date(currentYear, 0, 1)
  const endOfYear = new Date(currentYear + 1, 0, 1)

  try {
    // 1. 总投稿数
    const totalRequestsResult = await db
      .select({ count: count() })
      .from(songs)
      .where(
        and(
          eq(songs.requesterId, userId),
          gte(songs.createdAt, startOfYear),
          lt(songs.createdAt, endOfYear)
        )
      )
    const totalRequests = Number(totalRequestsResult[0].count)

    // 2. 已播放投稿数
    const playedRequestsResult = await db
      .select({ count: count() })
      .from(songs)
      .where(
        and(
          eq(songs.requesterId, userId),
          eq(songs.played, true),
          gte(songs.createdAt, startOfYear),
          lt(songs.createdAt, endOfYear)
        )
      )
    const playedRequests = Number(playedRequestsResult[0].count)

    // 3. 最喜欢的歌手
    const topArtistResult = await db
      .select({
        artist: songs.artist,
        count: count(songs.id)
      })
      .from(songs)
      .where(
        and(
          eq(songs.requesterId, userId),
          gte(songs.createdAt, startOfYear),
          lt(songs.createdAt, endOfYear)
        )
      )
      .groupBy(songs.artist)
      .orderBy(desc(count(songs.id)))
      .limit(1)
    const topArtist = topArtistResult.length > 0 ? topArtistResult[0].artist : null

    // 4. 最常用的音乐平台
    const topPlatformResult = await db
      .select({
        platform: songs.musicPlatform,
        count: count(songs.id)
      })
      .from(songs)
      .where(
        and(
          eq(songs.requesterId, userId),
          gte(songs.createdAt, startOfYear),
          lt(songs.createdAt, endOfYear)
        )
      )
      .groupBy(songs.musicPlatform)
      .orderBy(desc(count(songs.id)))
      .limit(1)
    const topPlatform = topPlatformResult.length > 0 ? topPlatformResult[0].platform : null

    // 5. 总投票数
    const totalVotesResult = await db
      .select({ count: count() })
      .from(votes)
      .where(
        and(
          eq(votes.userId, userId),
          gte(votes.createdAt, startOfYear),
          lt(votes.createdAt, endOfYear)
        )
      )
    const totalVotes = Number(totalVotesResult[0].count)

    // 6. 最活跃月份
    let activeMonth = null
    try {
      const activeMonthResult = await db.execute(sql`
                SELECT EXTRACT(MONTH FROM "createdAt") as month, COUNT(*) as count
                FROM "Song"
                WHERE "requesterId" = ${userId}
                AND "createdAt" >= ${startOfYear.toISOString()}
                AND "createdAt" < ${endOfYear.toISOString()}
                GROUP BY month
                ORDER BY count DESC
                LIMIT 1
            `)

      if (activeMonthResult.length > 0) {
        activeMonth = Number(activeMonthResult[0].month)
      }
    } catch (e) {
      console.error('[YearReview] Failed to get active month:', e)
    }

    // 7. 年度第一首歌
    const firstSongResult = await db
      .select()
      .from(songs)
      .where(
        and(
          eq(songs.requesterId, userId),
          gte(songs.createdAt, startOfYear),
          lt(songs.createdAt, endOfYear)
        )
      )
      .orderBy(asc(songs.createdAt))
      .limit(1)
    const firstSong =
      firstSongResult.length > 0
        ? {
            title: firstSongResult[0].title,
            artist: firstSongResult[0].artist,
            cover: firstSongResult[0].cover,
            createdAt: firstSongResult[0].createdAt
          }
        : null

    const resultData = {
      year: currentYear,
      totalRequests,
      playedRequests,
      topArtist,
      topPlatform,
      totalVotes,
      activeMonth,
      firstSong
    }

    return {
      success: true,
      data: resultData
    }
  } catch (error) {
    console.error('Error fetching year review:', error)
    throw createError({
      statusCode: 500,
      message: '获取年度总结失败'
    })
  }
})
