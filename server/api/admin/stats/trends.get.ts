import { createError, defineEventHandler, getQuery } from 'h3'
import { and, count, db, eq, gte, songs } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

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
  const semester = query.semester as string

  try {
    // 构建查询条件
    const where = semester && semester !== 'all' ? { semester: semester } : {}

    // 获取最近30天的歌曲点播趋势
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 构建where条件
    let whereCondition = gte(songs.createdAt, thirtyDaysAgo)
    if (semester && semester !== 'all') {
      whereCondition = and(whereCondition, eq(songs.semester, semester))
    }

    // 使用Drizzle ORM的正确语法进行分组查询
    const trendData = await db
      .select({
        date: sql<string>`DATE(${songs.createdAt})`,
        count: count(songs.id)
      })
      .from(songs)
      .where(whereCondition)
      .groupBy(sql`DATE(${songs.createdAt})`)
      .orderBy(sql`DATE(${songs.createdAt}) ASC`)

    // 格式化数据
    const formattedData = trendData.map((item) => ({
      date: item.date,
      count: item.count
    }))

    return formattedData
  } catch (error) {
    console.error('获取趋势数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取趋势数据失败'
    })
  }
})
