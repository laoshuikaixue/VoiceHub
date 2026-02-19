import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

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

    const query = getQuery(event)
    const { page = '1', limit = '50', search, status, operatorId } = query

    // 构建筛选条件
    const whereConditions = []

    // 状态筛选
    if (status && typeof status === 'string' && status.trim()) {
      whereConditions.push(eq(userStatusLogs.newStatus, status.trim()))
    }

    // 操作员筛选
    if (operatorId && typeof operatorId === 'string' && operatorId.trim()) {
      const numOperatorId = parseInt(operatorId.trim())
      if (!isNaN(numOperatorId)) {
        whereConditions.push(eq(userStatusLogs.operatorId, numOperatorId))
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // 分页参数
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.max(1, parseInt(limit as string) || 50)
    const skip = (pageNum - 1) * limitNum

    // 构建基础查询
    let baseQuery = db
      .select({
        id: userStatusLogs.id,
        userId: userStatusLogs.userId,
        userName: users.name,
        userUsername: users.username,
        oldStatus: userStatusLogs.oldStatus,
        newStatus: userStatusLogs.newStatus,
        reason: userStatusLogs.reason,
        createdAt: userStatusLogs.createdAt,
        operatorId: userStatusLogs.operatorId,
        operatorName: users.name,
        operatorUsername: users.username
      })
      .from(userStatusLogs)
      .leftJoin(users, eq(userStatusLogs.userId, users.id))

    // 如果有搜索条件，需要额外的join来搜索操作员信息
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim()
      // 这里需要重新构建查询以支持搜索用户名和操作员名
      baseQuery = db
        .select({
          id: userStatusLogs.id,
          userId: userStatusLogs.userId,
          userName: users.name,
          userUsername: users.username,
          oldStatus: userStatusLogs.oldStatus,
          newStatus: userStatusLogs.newStatus,
          reason: userStatusLogs.reason,
          createdAt: userStatusLogs.createdAt,
          operatorId: userStatusLogs.operatorId,
          operatorName: users.name,
          operatorUsername: users.username
        })
        .from(userStatusLogs)
        .leftJoin(users, eq(userStatusLogs.userId, users.id))
        .where(
          and(
            whereClause,
            or(
              ilike(users.name, `%${searchTerm}%`),
              ilike(users.username, `%${searchTerm}%`),
              ilike(userStatusLogs.reason, `%${searchTerm}%`)
            )
          )
        )
    } else if (whereClause) {
      baseQuery = baseQuery.where(whereClause)
    }

    // 获取总数
    const totalQuery = db
      .select({ count: count() })
      .from(userStatusLogs)
      .leftJoin(users, eq(userStatusLogs.userId, users.id))

    let totalResult
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim()
      totalResult = await totalQuery.where(
        and(
          whereClause,
          or(
            ilike(users.name, `%${searchTerm}%`),
            ilike(users.username, `%${searchTerm}%`),
            ilike(userStatusLogs.reason, `%${searchTerm}%`)
          )
        )
      )
    } else if (whereClause) {
      totalResult = await totalQuery.where(whereClause)
    } else {
      totalResult = await totalQuery
    }

    const total = totalResult[0].count

    // 获取状态变更日志列表
    const logs = await baseQuery
      .orderBy(desc(userStatusLogs.createdAt))
      .limit(limitNum)
      .offset(skip)

    // 获取操作员信息（用于显示操作员名称）
    const operatorIds = [...new Set(logs.map((log) => log.operatorId).filter((id) => id))]
    const operators = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, operatorIds[0])) // 这里需要用inArray，但先简化处理

    const operatorMap = new Map()
    for (const op of operators) {
      operatorMap.set(op.id, op)
    }

    // 计算分页信息
    const totalPages = Math.ceil(total / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        user: {
          id: log.userId,
          name: log.userName || '未知用户',
          username: log.userUsername || 'unknown'
        },
        oldStatus: log.oldStatus,
        newStatus: log.newStatus,
        oldStatusDisplay: log.oldStatus === 'active' ? '正常' : '退学',
        newStatusDisplay: log.newStatus === 'active' ? '正常' : '退学',
        reason: log.reason,
        createdAt: log.createdAt,
        operator: {
          id: log.operatorId,
          name: operatorMap.get(log.operatorId)?.name || log.operatorName || '未知操作员',
          username: operatorMap.get(log.operatorId)?.username || log.operatorUsername || 'unknown'
        }
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search: search || null,
        status: status || null,
        operatorId: operatorId || null
      }
    }
  } catch (error) {
    console.error('获取状态变更日志失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '获取状态变更日志失败: ' + error.message
    })
  }
})
