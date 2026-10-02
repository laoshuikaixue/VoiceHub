import { defineEventHandler, getQuery, createError } from 'h3'
import { searchBilibiliVideos } from '~~/server/utils/native_bilibili'

/**
 * Bilibili 搜索接口
 *
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const keyword = query.keyword as string

  if (!keyword) {
    return []
  }

  try {
    return await searchBilibiliVideos(keyword)
  } catch (error: any) {
    console.error('Bilibili search error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Bilibili search failed'
    })
  }
})
