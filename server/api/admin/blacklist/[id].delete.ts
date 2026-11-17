import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
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

    await recordAdminAudit(event, 'blacklist.delete', {
      targetType: 'blacklist',
      targetId: id,
      summary: { type: blacklistItem.type, value: blacklistItem.value }
    })

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
