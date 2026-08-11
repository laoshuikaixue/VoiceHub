import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs, scheduleSongPool } from '~/drizzle/schema'
import { inArray, count, eq } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 返回有效计数（排除歌曲已删除的孤立记录）
const fetchPoolCount = async () => {
  const result = await db
    .select({ count: count() })
    .from(scheduleSongPool)
    .innerJoin(songs, eq(scheduleSongPool.songId, songs.id))
    .limit(1)
  return result[0]?.count || 0
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

  // 构建待插入值和跳过列表
  const insertValues = []
  const skipped = []

  for (const songId of songIds) {
    const song = songsMap.get(songId)
    if (!song) {
      skipped.push({ songId, reason: '歌曲不存在' })
      continue
    }
    insertValues.push({ songId, title: song.title, artist: song.artist, createdAt: now, addedBy: user.id })
  }

  // 批量插入
  let added = []
  if (insertValues.length > 0) {
    const inserted = await db
      .insert(scheduleSongPool)
      .values(insertValues.map((v) => ({ songId: v.songId, createdAt: v.createdAt, addedBy: v.addedBy })))
      .onConflictDoNothing()
      .returning()
    const insertedIds = new Set(inserted.map((r) => r.songId))
    for (const v of insertValues) {
      if (insertedIds.has(v.songId)) {
        added.push({ songId: v.songId, title: v.title, artist: v.artist })
      } else {
        skipped.push({ songId: v.songId, reason: '已在备选池中' })
      }
    }
  }

  return { added, skipped, total: await fetchPoolCount() }
})