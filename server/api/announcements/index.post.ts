import { defineEventHandler, readBody, createError, getCookie, getHeader } from 'h3'
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
    
    // 检查用户权限（只有管理员可以创建公告）
    const userRecord = await db.select().from(users).where(eq(users.id, user.userId)).limit(1)
    if (!userRecord[0] || !['ADMIN', 'SUPER_ADMIN'].includes(userRecord[0].role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }
    
    const body = await readBody(event)
    const {
      title,
      content,
      type, // 'INTERNAL' | 'EXTERNAL'
      priority = 0,
      startDate,
      endDate,
      backgroundColor = '#1a1a1a',
      textColor = '#ffffff',
      buttonColor = '#4F46E5'
    } = body
    
    // 验证必填字段
    if (!title || !content || !type) {
      throw createError({
        statusCode: 400,
        statusMessage: '标题、内容和类型为必填字段'
      })
    }
    
    if (!['INTERNAL', 'EXTERNAL'].includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: '公告类型必须是 INTERNAL 或 EXTERNAL'
      })
    }
    
    // 创建公告
    const [newAnnouncement] = await db.insert(announcements).values({
      title,
      content,
      type,
      priority: parseInt(priority) || 0,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdByUserId: user.userId,
      backgroundColor,
      textColor,
      buttonColor
    }).returning()
    
    return {
      success: true,
      announcement: newAnnouncement
    }
  } catch (error: any) {
    console.error('创建公告失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '创建公告失败'
    })
  }
})
