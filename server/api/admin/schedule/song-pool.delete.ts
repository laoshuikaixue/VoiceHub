import { defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { scheduleSongPool } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { fetchPoolCount } from '~~/server/utils/scheduleSongPool'

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const query = getQuery(event)
  const songIdsRaw = query.songIds

  let songIds: number[] = []
  if (typeof songIdsRaw === 'string') {
    songIds = songIdsRaw.split(',').map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0)
  } else if (Array.isArray(songIdsRaw)) {
    songIds = songIdsRaw.map((s) => Number.parseInt(String(s).trim(), 10)).filter((n) => Number.isInteger(n) && n > 0)
  }

  if (songIds.length === 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 必须为非空数组或逗号分隔字符串')
  }
  if (songIds.length > 1000) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'songIds 数量不能超过 1000')
  }

  const result = await db.delete(scheduleSongPool).where(inArray(scheduleSongPool.songId, songIds)).returning()
  return { ok: true, removed: result.length, total: await fetchPoolCount() }
})