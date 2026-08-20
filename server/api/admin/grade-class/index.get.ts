import { createError } from 'h3'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { gradeClass, users } from '~/drizzle/schema'
import { smartSort } from '~~/server/utils/grade-class-core'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const [rows, counts] = await Promise.all([
    db.select().from(gradeClass),
    // 当前各年级班级的活跃用户数（用于管理界面人数展示）
    db
      .select({
        grade: users.grade,
        class: users.class,
        count: sql<number>`count(*)::int`
      })
      .from(users)
      .where(and(eq(users.status, 'active'), isNotNull(users.grade), isNotNull(users.class)))
      .groupBy(users.grade, users.class)
  ])

  const countMap = new Map(
    counts.map((row) => [`${row.grade}\u0000${row.class}`, row.count])
  )

  const items = rows
    .map((item) => ({
      id: item.id,
      grade: item.grade,
      class: item.class,
      userCount: countMap.get(`${item.grade}\u0000${item.class}`) || 0
    }))
    .sort((a, b) => {
      const gradeResult = smartSort(a.grade, b.grade)
      return gradeResult || smartSort(a.class, b.class)
    })

  return {
    success: true,
    items
  }
})