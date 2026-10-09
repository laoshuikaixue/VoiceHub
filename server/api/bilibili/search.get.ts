import { defineEventHandler, getQuery, createError } from 'h3'
import { searchBilibiliVideos } from '~~/server/utils/native_bilibili'
import { recordDependencyCall } from '~~/server/utils/operations-metrics'

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
    const startedAt = Date.now()
    const results = await searchBilibiliVideos(keyword)
    recordDependencyCall('bilibili', { success: results.length > 0, emptyResult: results.length === 0, durationMs: Date.now() - startedAt })
    return results
  } catch (error: any) {
    recordDependencyCall('bilibili', { success: false, semanticFailure: true, durationMs: 0, error: error.message || String(error) })
    console.error('Bilibili search error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Bilibili search failed'
    })
  }
})
