import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { and, desc, eq, ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  try {
    const query = getQuery(event)
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : ''
    const keyword = typeof query.q === 'string' ? query.q.trim() : ''

    const conditions = [] as any[]
    if (status) {
      conditions.push(eq(cardCodes.status, status as any))
    }
    if (keyword) {
      conditions.push(
        or(
          ilike(cardCodes.code, `%${keyword}%`),
          ilike(cardCodes.note, `%${keyword}%`)
        )
      )
    }

    let queryBuilder = db.select().from(cardCodes)
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions))
    }

    const result = await queryBuilder.orderBy(desc(cardCodes.createdAt))
    return { success: true, data: result }
  } catch (err) {
    console.error('获取卡密列表失败', err)
    throw createError({ statusCode: 500, message: '获取卡密列表失败' })
  }
})
