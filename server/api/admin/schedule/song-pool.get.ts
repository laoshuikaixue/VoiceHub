import { defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { songs, scheduleSongPool, users, votes } from '~/drizzle/schema'
import { inArray, count } from 'drizzle-orm'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const isSuperAdmin = event.context.user?.role === 'SUPER_ADMIN'

  const poolRows = await db.select().from(scheduleSongPool).orderBy(scheduleSongPool.createdAt)

  if (poolRows.length === 0) {
    return { pool: [], count: 0 }
  }

  const poolSongIds = poolRows.map((row) => row.songId)
  const songsRows = await db.select().from(songs).where(inArray(songs.id, poolSongIds))
  const songsMap = new Map(songsRows.map((s) => [s.id, s]))

  // 批量加载投稿人信息
  const requesterIds = [...new Set(songsRows.map((s) => s.requesterId).filter(Boolean))]
  const requesterMap = new Map()
  if (requesterIds.length > 0) {
    const userRows = await db.select().from(users).where(inArray(users.id, requesterIds))
    userRows.forEach((u) => requesterMap.set(u.id, u))
  }

  // 批量加载添加者信息
  const addedByIds = [...new Set(poolRows.map((row) => row.addedBy).filter(Boolean))]
  const addedByUsersMap = new Map()
  if (addedByIds.length > 0) {
    const userRows = await db.select().from(users).where(inArray(users.id, addedByIds))
    userRows.forEach((u) => addedByUsersMap.set(u.id, u))
  }

  // 批量加载投票数
  const voteCountMap = new Map()
  if (poolSongIds.length > 0) {
    const voteCountsResult = await db
      .select({ songId: votes.songId, count: count() })
      .from(votes)
      .where(inArray(votes.songId, poolSongIds))
      .groupBy(votes.songId)
    voteCountsResult.forEach((v) => voteCountMap.set(v.songId, v.count))
  }

  const pool = poolRows.map((row) => {
    const song = songsMap.get(row.songId)
    if (!song) return null
    const requesterUser = song.requesterId ? requesterMap.get(song.requesterId) : null
    const addedByUser = row.addedBy ? addedByUsersMap.get(row.addedBy) : null
    return {
      poolId: row.id,
      songId: row.songId,
      title: song.title,
      artist: song.artist,
      durationSeconds: song.durationSeconds,
      requester: requesterUser ? (requesterUser.name || requesterUser.username || 'Unknown User') : 'Unknown User',
      requesterId: song.requesterId,
      requesterGrade: requesterUser?.grade || null,
      requesterClass: requesterUser?.class || null,
      preferredPlayTimeId: song.preferredPlayTimeId,
      cover: song.cover,
      semester: song.semester,
      musicId: song.musicId,
      musicPlatform: song.musicPlatform,
      voteCount: voteCountMap.get(row.songId) || 0,
      cardCodeId: song.cardCodeId,
      usedCardCode: song.cardCodeId != null,
      hasSubmissionNote: song.submissionNote ? true : false,
      submissionNote: isSuperAdmin ? song.submissionNote : undefined,
      addedBy: row.addedBy,
      addedByName: addedByUser?.name || addedByUser?.username || null,
      createdAt: row.createdAt
    }
  }).filter(Boolean)

  return { pool, count: pool.length } // 有效记录数（已过滤掉歌曲被删除的孤立记录）
})