import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists } from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'
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

  const body = await readBody(event)
  const { type, value, reason } = body

  // 验证输入
  if (!type || !value) {
    throw createError({
      statusCode: 400,
      message: '类型和值不能为空'
    })
  }

  if (!['SONG', 'KEYWORD'].includes(type)) {
    throw createError({
      statusCode: 400,
      message: '无效的黑名单类型'
    })
  }

  try {
    // 检查是否已存在
    const existing = await db
      .select()
      .from(songBlacklists)
      .where(and(eq(songBlacklists.type, type), eq(songBlacklists.value, value.trim())))
      .limit(1)

    if (existing.length > 0) {
      throw createError({
        statusCode: 409,
        message: '该项目已在黑名单中'
      })
    }

    // 创建黑名单项
    const blacklistItem = await db
      .insert(songBlacklists)
      .values({
        type,
        value: value.trim(),
        reason: reason?.trim() || null,
        createdBy: user.id,
        isActive: true
      })
      .returning()

    // 清除歌曲缓存（黑名单变更可能影响歌曲提交验证）
    try {
      const cacheService = CacheService.getInstance()
      await cacheService.clearSongsCache()
      console.log('黑名单添加后歌曲缓存已清除')
    } catch (cacheError) {
      console.warn('清除歌曲缓存失败:', cacheError)
    }

    return {
      success: true,
      message: '黑名单项添加成功',
      item: blacklistItem[0]
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }
    console.error('添加黑名单项失败:', error)
    throw createError({
      statusCode: 500,
      message: '添加黑名单项失败'
    })
  }
})
