import { db, eq } from '~/drizzle/db'
import { schedules } from '~/drizzle/schema'
import { cacheService } from '~~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  // 验证用户认证和权限
  const user = event.context.user
  if (!user || !['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '需要歌曲管理员及以上权限'
    })
  }

  try {
    const body = await readBody(event)
    const { schedules } = body

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少排期数据'
      })
    }

    // 批量更新排期顺序
    const results = await Promise.all(
      schedules.map(async (item) => {
        return db
          .update(schedules)
          .set({ sequence: item.sequence })
          .where(eq(schedules.id, Number(item.id)))
      })
    )

    // 清除排期相关缓存
    try {
      await cacheService.clearSchedulesCache()
      await cacheService.clearSongsCache()
      console.log('[Cache] 排期缓存和歌曲列表缓存已清除（更新排期顺序）')
    } catch (cacheError) {
      console.error('[Cache] 清除缓存失败:', cacheError)
    }

    return {
      success: true,
      count: results.length
    }
  } catch (error: any) {
    console.error('更新排期顺序失败:', error)

    throw createError({
      statusCode: 500,
      statusMessage: error.message || '更新排期顺序失败'
    })
  }
})
