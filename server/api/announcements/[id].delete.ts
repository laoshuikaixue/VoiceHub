import { defineEventHandler, createError, getCookie, getHeader, getRouterParam } from 'h3'
import jwt from 'jsonwebtoken'
import { db } from '~/drizzle/db'
import { announcements, users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 验证用户身份和权限
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: '未授权访问'
      })
    }
    
    let user
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as any
    } catch (error) {
      throw createError({
        statusCode: 401,
        statusMessage: '无效的认证令牌'
      })
    }
    
    // 检查用户权限
    const userRecord = await db.select().from(users).where(eq(users.id, user.userId)).limit(1)
    if (!userRecord[0] || !['ADMIN', 'SUPER_ADMIN'].includes(userRecord[0].role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }
    
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
    
    // 删除公告
    await db.delete(announcements)
      .where(eq(announcements.id, parseInt(announcementId)))
    
    return {
      success: true,
      message: '公告删除成功'
    }
  } catch (error: any) {
    console.error('删除公告失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '删除公告失败'
    })
  }
})
