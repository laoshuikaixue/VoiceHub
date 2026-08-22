import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { getStatusText } from '~~/server/utils/user'

export default defineEventHandler(async (event) => {
  try {
    // 妫€鏌ヨ璇佸拰鏉冮檺
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '娌℃湁鏉冮檺璁块棶'
      })
    }

    const query = getQuery(event)
    const { page = '1', limit = '50', search, status, operatorId } = query

    // 鏋勫缓绛涢€夋潯浠?
    const whereConditions = []

    // 鐘舵€佺瓫閫?
    if (status && typeof status === 'string' && status.trim()) {
      whereConditions.push(eq(userStatusLogs.newStatus, status.trim()))
    }

    // 鎿嶄綔鍛樼瓫閫?
    if (operatorId && typeof operatorId === 'string' && operatorId.trim()) {
      const numOperatorId = parseInt(operatorId.trim())
      if (!isNaN(numOperatorId)) {
        whereConditions.push(eq(userStatusLogs.operatorId, numOperatorId))
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // 鍒嗛〉鍙傛暟
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.max(1, parseInt(limit as string) || 50)
    const skip = (pageNum - 1) * limitNum

    // 鏋勫缓鍩虹鏌ヨ
    let baseQuery = db
      .select({
        id: userStatusLogs.id,
        userId: userStatusLogs.userId,
        userName: userStatusLogs.name,
        userUsername: userStatusLogs.username,
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

    // 濡傛灉鏈夋悳绱㈡潯浠讹紝闇€瑕侀澶栫殑join鏉ユ悳绱㈡搷浣滃憳淇℃伅
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim()
      // 杩欓噷闇€瑕侀噸鏂版瀯寤烘煡璇互鏀寔鎼滅储鐢ㄦ埛鍚嶅拰鎿嶄綔鍛樺悕
      baseQuery = db
        .select({
          id: userStatusLogs.id,
          userId: userStatusLogs.userId,
          userName: userStatusLogs.name,
          userUsername: userStatusLogs.username,
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

    // 鑾峰彇鎬绘暟
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

    // 鑾峰彇鐘舵€佸彉鏇存棩蹇楀垪琛?
    const logs = await baseQuery
      .orderBy(desc(userStatusLogs.createdAt))
      .limit(limitNum)
      .offset(skip)

    // 鑾峰彇鎿嶄綔鍛樹俊鎭紙鐢ㄤ簬鏄剧ず鎿嶄綔鍛樺悕绉帮級
    const operatorIds = [...new Set(logs.map((log) => log.operatorId).filter((id) => id))]
    const operators = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, operatorIds[0])) // 杩欓噷闇€瑕佺敤inArray锛屼絾鍏堢畝鍖栧鐞?

    const operatorMap = new Map()
    for (const op of operators) {
      operatorMap.set(op.id, op)
    }

    // 璁＄畻鍒嗛〉淇℃伅
    const totalPages = Math.ceil(total / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        user: {
          id: log.userId,
          name: log.userName || '鏈煡鐢ㄦ埛',
          username: log.userUsername || 'unknown'
        },
        oldStatus: log.oldStatus,
        newStatus: log.newStatus,
        oldStatusDisplay: getStatusText(log.oldStatus || ''),
        newStatusDisplay: getStatusText(log.newStatus || ''),
        reason: log.reason,
        createdAt: log.createdAt,
        operator: {
          id: log.operatorId,
          name: operatorMap.get(log.operatorId)?.name || log.operatorName || '鏈煡鎿嶄綔鍛?,
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
    console.error('鑾峰彇鐘舵€佸彉鏇存棩蹇楀け璐?', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '鑾峰彇鐘舵€佸彉鏇存棩蹇楀け璐? ' + error.message
    })
  }
})
