import { db } from '~/drizzle/db'
import { songs, scheduleSongPool } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有歌曲管理员及以上权限才能管理备选池')
  }

  const poolRows = await db.select().from(scheduleSongPool).orderBy(scheduleSongPool.createdAt)

  if (poolRows.length === 0) {
    return { pool: [], count: 0 }
  }

  const songIds = poolRows.map((row) => row.songId)
  const songsRows = await db.select().from(songs).where(inArray(songs.id, songIds))
  const songsMap = new Map(songsRows.map((s) => [s.id, s]))

  const pool = poolRows.map((row) => {
    const song = songsMap.get(row.songId)
    if (!song) return null
    return {
      poolId: row.id,
      songId: row.songId,
      title: song.title,
      artist: song.artist,
      durationSeconds: song.durationSeconds,
      requester: song.requester,
      requesterId: song.requesterId,
      requesterGrade: song.requesterGrade,
      requesterClass: song.requesterClass,
      preferredPlayTimeId: song.preferredPlayTimeId,
      cover: song.cover,
      semester: song.semester,
      musicId: song.musicId,
      musicPlatform: song.musicPlatform,
      voteCount: song.voteCount,
      cardCodeId: song.cardCodeId,
      usedCardCode: song.usedCardCode,
      hasSubmissionNote: song.submissionNote ? true : false,
      submissionNote: song.submissionNote,
      createdAt: row.createdAt
    }
  }).filter(Boolean)

  return { pool, count: pool.length }
})