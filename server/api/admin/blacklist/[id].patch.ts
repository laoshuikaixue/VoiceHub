import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

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

  const body = await readBody(event)
  const { isActive, reason } = body

  try {
    // 检查黑名单项是否存在
    const existingItemResult = await db
      .select()
      .from(songBlacklists)
      .where(eq(songBlacklists.id, id))
      .limit(1)

    if (existingItemResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: '黑名单项不存在'
      })
    }

    // 更新黑名单项
    const updateData = {}
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive
    }
    if (reason !== undefined) {
      updateData.reason = reason?.trim() || null
    }

    const updatedItem = await db
      .update(songBlacklists)
      .set(updateData)
      .where(eq(songBlacklists.id, id))
      .returning()

    return {
      success: true,
      message: '黑名单项更新成功',
      item: updatedItem[0]
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }
    console.error('更新黑名单项失败:', error)
    throw createError({
      statusCode: 500,
      message: '更新黑名单项失败'
    })
  }
})
