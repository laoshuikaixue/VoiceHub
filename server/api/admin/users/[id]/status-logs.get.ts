import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { count, desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证和权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '没有权限访问'
      })
    }

    const userId = getRouterParam(event, 'id')
    const query = getQuery(event)
    const { page = '1', limit = '20' } = query

    // 验证用户ID
    const numUserId = parseInt(userId)
    if (isNaN(numUserId) || numUserId <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的用户ID'
      })
    }

    // 检查用户是否存在
    const existingUser = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, numUserId))
      .limit(1)

    if (existingUser.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 分页参数
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.max(1, parseInt(limit as string) || 20)
    const skip = (pageNum - 1) * limitNum

    // 获取总数
    const totalResult = await db
      .select({ count: count() })
      .from(userStatusLogs)
      .where(eq(userStatusLogs.userId, numUserId))
    const total = totalResult[0].count

    // 获取状态变更日志列表
    const logs = await db
      .select({
        id: userStatusLogs.id,
        oldStatus: userStatusLogs.oldStatus,
        newStatus: userStatusLogs.newStatus,
        reason: userStatusLogs.reason,
        createdAt: userStatusLogs.createdAt,
        operatorId: userStatusLogs.operatorId,
        operatorName: users.name,
        operatorUsername: users.username
      })
      .from(userStatusLogs)
      .leftJoin(users, eq(userStatusLogs.operatorId, users.id))
      .where(eq(userStatusLogs.userId, numUserId))
      .orderBy(desc(userStatusLogs.createdAt))
      .limit(limitNum)
      .offset(skip)

    // 计算分页信息
    const totalPages = Math.ceil(total / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      success: true,
      user: existingUser[0],
      logs: logs.map((log) => ({
        id: log.id,
        oldStatus: log.oldStatus,
        newStatus: log.newStatus,
        oldStatusDisplay: log.oldStatus === 'active' ? '正常' : '退学',
        newStatusDisplay: log.newStatus === 'active' ? '正常' : '退学',
        reason: log.reason,
        createdAt: log.createdAt,
        operator: {
          id: log.operatorId,
          name: log.operatorName || '未知操作员',
          username: log.operatorUsername || 'unknown'
        }
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    }
  } catch (error) {
    console.error('获取用户状态变更日志失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '获取用户状态变更日志失败: ' + error.message
    })
  }
})
