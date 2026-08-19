import { defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs, scheduleSongPool } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { fetchPoolCount } from '~~/server/utils/scheduleSongPool'
import { fetchSongDuration } from '~~/server/utils/songDurationFetcher'
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)
  const user = event.context.user as any
  const body = await readBody(event)
  if (!Array.isArray(body.songIds) || body.songIds.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 必须为非空数组')
  }
  const songIds = body.songIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (songIds.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 全部无效')
  }
  if (songIds.length > 1000) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 数量不能超过 1000')
  }
  const now = getServerDate()
  // 批量查询歌曲，避免 N+1
  const songsRows = await db.select().from(songs).where(inArray(songs.id, songIds))
  // 补全缺失时长
  const missingDurationSongs = songsRows.filter(
    (s) => s.durationSeconds == null && s.musicPlatform && s.musicId
  )
  for (const song of missingDurationSongs) {
    const duration = await fetchSongDuration(song.musicPlatform, song.musicId)
    if (duration != null) {
      await db.update(songs).set({ durationSeconds: duration }).where(eq(songs.id, song.id))
    }
  }
  // 重新查询确保拿到最新时长
  const refreshedSongs = await db.select().from(songs).where(inArray(songs.id, songIds))
  const refreshedMap = new Map(refreshedSongs.map((s) => [s.id, s]))
  // 构建待插入值和跳过列表
  const insertValues = []
  const skipped = []
  for (const songId of songIds) {
    const song = refreshedMap.get(songId)
    if (!song) {
      skipped.push({ songId, reason: '歌曲不存在（无法加入备选池）' })
      continue
    }
    insertValues.push({ songId, title: song.title, artist: song.artist, createdAt: now, addedBy: user.id })
  }
  // 批量插入
  const added = []
  if (insertValues.length > 0) {
    const inserted = await db
      .insert(scheduleSongPool)
      .values(insertValues.map((v) => ({ songId: v.songId, createdAt: v.createdAt, addedBy: v.addedBy })))
      .onConflictDoNothing({ target: [scheduleSongPool.songId] })
      .returning()
    const insertedIds = new Set(inserted.map((r) => r.songId))
    for (const v of insertValues) {
      if (insertedIds.has(v.songId)) {
        added.push({ songId: v.songId, title: v.title, artist: v.artist })
      } else {
        skipped.push({ songId: v.songId, reason: '已存在于备选池' })
      }
    }
  }
  return { added, skipped, total: await fetchPoolCount() }
})
