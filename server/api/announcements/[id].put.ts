import { defineEventHandler, readBody, createError, getCookie, getHeader, getRouterParam } from 'h3'
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
    
    const body = await readBody(event)
    const {
      title,
      content,
      type,
      priority,
      startDate,
      endDate,
      isActive,
      backgroundColor,
      textColor,
      buttonColor
    } = body
    
    // 构建更新数据
    const updateData: any = {
      updatedAt: new Date()
    }
    
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (type !== undefined) {
      if (!['INTERNAL', 'EXTERNAL'].includes(type)) {
        throw createError({
          statusCode: 400,
          statusMessage: '公告类型必须是 INTERNAL 或 EXTERNAL'
        })
      }
      updateData.type = type
    }
    if (priority !== undefined) updateData.priority = parseInt(priority) || 0
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (isActive !== undefined) updateData.isActive = isActive
    if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor
    if (textColor !== undefined) updateData.textColor = textColor
    if (buttonColor !== undefined) updateData.buttonColor = buttonColor
    
    // 更新公告
    const [updatedAnnouncement] = await db.update(announcements)
      .set(updateData)
      .where(eq(announcements.id, parseInt(announcementId)))
      .returning()
    
    return {
      success: true,
      announcement: updatedAnnouncement
    }
  } catch (error: any) {
    console.error('更新公告失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '更新公告失败'
    })
  }
})
