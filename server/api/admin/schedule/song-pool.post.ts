import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs, scheduleSongPool } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 返回有效计数（排除歌曲已删除的孤立记录）
const fetchPoolCount = async () => {
  const poolRows = await db.select({ songId: scheduleSongPool.songId }).from(scheduleSongPool)
  if (poolRows.length === 0) return 0
  const songIds = poolRows.map((row) => row.songId)
  const songsRows = await db.select({ id: songs.id }).from(songs).where(inArray(songs.id, songIds))
  const validIds = new Set(songsRows.map((s) => s.id))
  return poolRows.filter((row) => validIds.has(row.songId)).length
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有歌曲管理员及以上权限才能管理备选池')
  }

  const body = await readBody(event)
  if (!Array.isArray(body.songIds) || body.songIds.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 必须为非空数组')
  }

  const songIds = body.songIds.map(Number).filter((n) => !Number.isNaN(n))
  const now = getServerDate()

  // 批量查询歌曲，避免 N+1
  const songsRows = await db.select({
    id: songs.id,
    title: songs.title,
    artist: songs.artist
  }).from(songs).where(inArray(songs.id, songIds))
  const songsMap = new Map(songsRows.map((s) => [s.id, s]))

  const added = []
  const skipped = []

  for (const songId of songIds) {
    const song = songsMap.get(songId)
    if (!song) {
      skipped.push({ songId, reason: '歌曲不存在' })
      continue
    }

    try {
      const inserted = await db
        .insert(scheduleSongPool)
        .values({ songId, createdAt: now, addedBy: user.id })
        .onConflictDoNothing()
        .returning()
      if (inserted.length > 0) {
        added.push({ songId, title: song.title, artist: song.artist })
      } else {
        skipped.push({ songId, reason: '已在备选池中' })
      }
    } catch {
      skipped.push({ songId, reason: '添加失败' })
    }
  }

  return { added, skipped, total: await fetchPoolCount() }
})