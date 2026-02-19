import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists } from '~/drizzle/schema'
import { and, count, desc, eq, ilike } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const type = query.type as string
  const search = query.search as string

  try {
    // 构建查询条件
    const whereConditions = []
    if (type) {
      whereConditions.push(eq(songBlacklists.type, type))
    }
    if (search) {
      whereConditions.push(ilike(songBlacklists.value, `%${search}%`))
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // 获取总数
    const totalResult = await db.select({ count: count() }).from(songBlacklists).where(whereClause)
    const total = totalResult[0].count

    // 获取黑名单列表
    const blacklist = await db
      .select()
      .from(songBlacklists)
      .where(whereClause)
      .orderBy(desc(songBlacklists.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)

    return {
      blacklist,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    console.error('获取黑名单失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取黑名单失败'
    })
  }
})
