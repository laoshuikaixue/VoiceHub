import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { count, eq } from 'drizzle-orm'
import { cache } from '~~/server/utils/cache-helpers'
import { isRedisReady } from '~~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const semester = query.semester as string

  try {
    // 构建缓存键
    const cacheKey = semester ? `songs:count:${semester}` : 'songs:count:all'

    // 尝试从缓存获取
    const cachedCount = await cache.get<{ count: number }>(cacheKey)
    if (cachedCount !== null) {
      if (isRedisReady()) {
        console.log(`[Cache] 歌曲数量缓存命中: ${cacheKey}, 数量: ${cachedCount.count}`)
      }
      return cachedCount
    }

    // 缓存未命中，查询数据库
    let countQuery = db.select({ count: count() }).from(songs)

    if (semester) {
      countQuery = countQuery.where(eq(songs.semester, semester))
    }

    const result = await countQuery
    const totalCount = result[0]?.count || 0

    const response = {
      count: totalCount
    }

    // 缓存结果（5分钟）
    await cache.set(cacheKey, response)
    if (isRedisReady()) {
      console.log(`[Cache] 歌曲数量设置缓存: ${cacheKey}, 数量: ${totalCount}`)
    }

    return response
  } catch (error) {
    console.error('获取歌曲数量失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取歌曲数量失败'
    })
  }
})
