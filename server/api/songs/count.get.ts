import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { count, eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const semester = query.semester as string

  try {
    const result = semester
      ? await db.select({ count: count() }).from(songs).where(eq(songs.semester, semester))
      : await db.select({ count: count() }).from(songs)
    const totalCount = result[0]?.count || 0

    return {
      count: totalCount
    }
  } catch (error) {
    console.error('获取歌曲数量失败:', error)
    throw createApiError(500, 'SONG_FETCH_COUNT_FAILED', '获取歌曲数量失败')
  }
})
