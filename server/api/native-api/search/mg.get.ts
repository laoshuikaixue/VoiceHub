import { defineEventHandler, getQuery, createError } from 'h3'
import { searchMiguSongs } from '~~/server/utils/native_mg'

/**
 * 咪咕搜索接口
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const str = query.str as string
  const page = parseInt((query.page as string) || '1')
  const limit = parseInt((query.limit as string) || '30')

  if (!str) {
    throw createError({ statusCode: 400, message: 'Missing search query' })
  }

  try {
    const result = await searchMiguSongs(str, page, limit)
    return {
      ...result,
      page,
      limit,
      source: 'mg'
    }
  } catch (err: any) {
    console.error('[mg.get] 咪咕搜索失败:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Internal Server Error'
    })
  }
})
