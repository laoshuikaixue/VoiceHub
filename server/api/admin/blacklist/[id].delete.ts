import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { CacheService } from '../../../services/cacheService'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const id = parseInt(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '无效的ID'
    })
  }

  try {
    // 检查黑名单项是否存在
    const blacklistItemResult = await db
      .select()
      .from(songBlacklists)
      .where(eq(songBlacklists.id, id))
      .limit(1)
    const blacklistItem = blacklistItemResult[0]

    if (!blacklistItem) {
      throw createError({
        statusCode: 404,
        message: '黑名单项不存在'
      })
    }

    // 删除黑名单项
    await db.delete(songBlacklists).where(eq(songBlacklists.id, id))

    // 清除歌曲缓存（黑名单变更可能影响歌曲提交验证）
    try {
      const cacheService = CacheService.getInstance()
      await cacheService.clearSongsCache()
      console.log('黑名单删除后歌曲缓存已清除')
    } catch (cacheError) {
      console.warn('清除歌曲缓存失败:', cacheError)
    }

    return {
      success: true,
      message: '黑名单项删除成功'
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }
    console.error('删除黑名单项失败:', error)
    throw createError({
      statusCode: 500,
      message: '删除黑名单项失败'
    })
  }
})
