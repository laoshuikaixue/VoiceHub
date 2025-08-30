import { defineEventHandler, createError, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { announcements } from '~/drizzle/schema'
import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const announcementId = getRouterParam(event, 'id')
    if (!announcementId) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少公告ID'
      })
    }
    
    // 检查公告是否存在
    const existingAnnouncement = await db.select().from(announcements)
      .where(eq(announcements.id, parseInt(announcementId)))
      .limit(1)
    
    if (!existingAnnouncement[0]) {
      throw createError({
        statusCode: 404,
        statusMessage: '公告不存在'
      })
    }
    
    // 增加浏览量
    await db.update(announcements)
      .set({
        viewCount: sql`${announcements.viewCount} + 1`
      })
      .where(eq(announcements.id, parseInt(announcementId)))
    
    return {
      success: true,
      message: '浏览量更新成功'
    }
  } catch (error: any) {
    console.error('更新浏览量失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '更新浏览量失败'
    })
  }
})
