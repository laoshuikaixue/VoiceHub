import { getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { scheduleSongPool, songs } from '~/drizzle/schema'
import { inArray, count } from 'drizzle-orm'
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

  const query = getQuery(event)
  const songIdsRaw = query.songIds

  let songIds: number[] = []
  if (typeof songIdsRaw === 'string') {
    songIds = songIdsRaw.split(',').map((s) => Number(s)).filter((n) => !Number.isNaN(n))
  } else if (Array.isArray(songIdsRaw)) {
    songIds = songIdsRaw.map((s) => Number(s)).filter((n) => !Number.isNaN(n))
  }

  if (songIds.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 必须为非空数组或逗号分隔字符串')
  }

  const result = await db.delete(scheduleSongPool).where(inArray(scheduleSongPool.songId, songIds)).returning()
  return { ok: true, removed: result.length, total: await fetchPoolCount() }
})