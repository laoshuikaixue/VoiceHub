import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, asc, eq, ilike, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { UNSET_KEY } from '~~/server/utils/recipient-tree'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'

/** 按姓名与年级班级查询接收人及组织统计。 */
const MAX_PREVIEW_COUNT = 2000

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const query = getQuery(event)
  const keyword = typeof query.q === 'string' ? query.q.trim() : ''
  const grade = typeof query.grade === 'string' ? query.grade.trim() : ''
  const className = typeof query.class === 'string' ? query.class.trim() : ''
  const returnAll = query.all === '1' || query.all === 'true'
  const withFacets = query.facets === '1' || query.facets === 'true'

  const conditions = [ne(users.status, 'pending')]
  if (keyword) {
    conditions.push(or(ilike(users.name, `%${keyword}%`), ilike(users.username, `%${keyword}%`))!)
  }
  if (grade) {
    // 空串与 NULL 均归为未设置
    conditions.push(
      grade === UNSET_KEY ? or(isNull(users.grade), eq(users.grade, ''))! : eq(users.grade, grade)
    )
  }
  if (className) {
    conditions.push(
      className === UNSET_KEY ? or(isNull(users.class), eq(users.class, ''))! : eq(users.class, className)
    )
  }

  const whereClause = and(...conditions)

  // 维度统计：当前各年级/班级组合的可用接收人数（不受关键词影响）
  let facets:
    | {
        grades: Array<{ value: string; userCount: number }>
        classes: Array<{ grade: string; class: string; userCount: number }>
      }
    | undefined
  if (withFacets) {
    const [gradeRows, classRows] = await Promise.all([
      db
        .select({
          value: users.grade,
          userCount: sql<number>`count(*)::int`
        })
        .from(users)
        .where(and(ne(users.status, 'pending'), isNotNull(users.grade)))
        .groupBy(users.grade)
        .orderBy(asc(users.grade)),
      db
        .select({
          grade: users.grade,
          class: users.class,
          userCount: sql<number>`count(*)::int`
        })
        .from(users)
        .where(and(ne(users.status, 'pending'), isNotNull(users.grade), isNotNull(users.class)))
        .groupBy(users.grade, users.class)
        .orderBy(asc(users.grade), asc(users.class))
    ])
    facets = {
      grades: gradeRows
        .filter((row) => Boolean(row.value))
        .map((row) => ({ value: String(row.value), userCount: Number(row.userCount || 0) })),
      classes: classRows.map((row) => ({
        grade: String(row.grade),
        class: String(row.class),
        userCount: Number(row.userCount || 0)
      }))
    }
  }

  // 有筛选条件或明确要求全量时放宽上限，否则按搜索联想场景限制条数
  const hasFilter = Boolean(keyword || grade || className)
  const limit = returnAll || hasFilter ? MAX_PREVIEW_COUNT : 30

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      grade: users.grade,
      class: users.class,
      role: users.role,
      status: users.status
    })
    .from(users)
    .where(whereClause)
    .orderBy(asc(users.username))
    .limit(limit)

  return {
    success: true,
    data: rows,
    total: rows.length,
    truncated: rows.length >= limit,
    ...(facets ? { facets } : {})
  }
})
