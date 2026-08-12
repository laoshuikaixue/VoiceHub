import { asc, and, eq, inArray } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists, songs } from '~/drizzle/schema'
import { executeSequentialSongImports } from '~~/server/services/songQuotaService'
import { requestSongForUser } from '~~/server/services/songRequestService'
import { createApiError } from '~~/server/utils/apiError'
import { createImportSongRequestId } from '~~/server/utils/song-request-policy'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_LOGIN_REQUIRED', '需要登录')
  }

  const body = await readBody(event)
  const { songIds, importBatchId } = body || {}
  if (!Array.isArray(songIds) || songIds.length === 0) {
    throw createApiError(400, 'SONG_SELECT_TO_IMPORT', '请选择要导入的歌曲')
  }

  const originalSongs = await db
    .select()
    .from(songs)
    .where(and(inArray(songs.id, songIds), eq(songs.requesterId, user.id)))
    .orderBy(asc(songs.createdAt))

  const blacklistItems = await db
    .select()
    .from(songBlacklists)
    .where(eq(songBlacklists.isActive, true))

  const results = await executeSequentialSongImports(originalSongs, async (song, index) => {
    const songFullName = `${song.title} - ${song.artist || ''}`.toLowerCase()
    const blocked = blacklistItems.find((item) =>
      (item.type === 'SONG' || item.type === 'KEYWORD') &&
      songFullName.includes(item.value.toLowerCase())
    )
    if (blocked) {
      throw new Error(blocked.reason || (blocked.type === 'SONG' ? '黑名单歌曲' : '包含违规关键词'))
    }

    return requestSongForUser(event, user, {
      title: song.title,
      artist: song.artist,
      cover: song.cover,
      playUrl: song.playUrl,
      musicPlatform: song.musicPlatform,
      musicId: song.musicId
    }, {
      requestId: createImportSongRequestId(importBatchId, index, song.id)
    })
  })

  const songTitleById = new Map(originalSongs.map((song) => [song.id, song.title]))
  return {
    success: true,
    count: results.success,
    results: {
      ...results,
      details: results.details
        .filter((detail) => !detail.success)
        .map((detail) => `《${songTitleById.get(detail.sourceId) || '未知歌曲'}》: ${detail.error}`)
    }
  }
})
