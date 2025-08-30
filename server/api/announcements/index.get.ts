import { defineEventHandler, getQuery, getCookie, getHeader, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { db } from '~/drizzle/db'
import { announcements, users } from '~/drizzle/schema'
import { eq, and, gte, lte, or, desc, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const type = query.type as string // 'INTERNAL' | 'EXTERNAL' | 'ALL'
    
    // 检查用户是否已登录
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    let isLoggedIn = false
    let user = null
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        isLoggedIn = true
        user = decoded
      } catch (error) {
        isLoggedIn = false
      }
    }
    
    // 构建查询条件
    const now = new Date()
    let whereConditions = [
      eq(announcements.isActive, true),
      or(
        isNull(announcements.startDate),
        lte(announcements.startDate, now)
      ),
      or(
        isNull(announcements.endDate),
        gte(announcements.endDate, now)
      )
    ]
    
    // 根据类型和登录状态过滤
    if (type === 'INTERNAL') {
      // 站内公告：只有登录用户才能看到
      if (!isLoggedIn) {
        return []
      }
      whereConditions.push(eq(announcements.type, 'INTERNAL'))
    } else if (type === 'EXTERNAL') {
      // 站外公告：所有人都能看到
      whereConditions.push(eq(announcements.type, 'EXTERNAL'))
    } else {
      // 全部公告：根据登录状态返回相应的公告
      if (isLoggedIn) {
        // 登录用户：返回所有类型的公告
        whereConditions.push(or(
          eq(announcements.type, 'INTERNAL'),
          eq(announcements.type, 'EXTERNAL')
        ))
      } else {
        // 未登录用户：只返回站外公告
        whereConditions.push(eq(announcements.type, 'EXTERNAL'))
      }
    }
    
    // 查询公告
    const announcementList = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        type: announcements.type,
        priority: announcements.priority,
        createdAt: announcements.createdAt,
        backgroundColor: announcements.backgroundColor,
        textColor: announcements.textColor,
        buttonColor: announcements.buttonColor,
        createdBy: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.createdByUserId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(announcements.priority), desc(announcements.createdAt))
    
    return {
      success: true,
      data: announcementList,
      count: announcementList.length
    }
  } catch (error) {
    console.error('获取公告失败:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : 'No stack trace'
    const errorCause = error instanceof Error ? error.cause : undefined
    
    console.error('错误详情:', {
      message: errorMessage,
      stack: errorStack,
      cause: errorCause
    })
    throw createError({
      statusCode: 500,
      statusMessage: `获取公告失败: ${errorMessage}`
    })
  }
})
