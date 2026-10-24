import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, asc, eq, ilike, isNotNull, ne, or, sql } from 'drizzle-orm'

/**
 * 派发点歌券时的接收人查询。
 *
 * 与 /api/users/search 的区别：这里返回真实姓名与用户名（管理端派发需要核对具体对象），
 * 且排除待审核账号（未通过审核的用户无法接收点歌券）。
 *
 * 支持的查询维度：
 * - q：按姓名/用户名搜索
 * - tags：按标签过滤（命中任意一个标签即返回，多个用逗号分隔）
 * - grade / class：按年级/班级过滤
 * - all=1：返回全部匹配结果（上限 2000，用于派发前名单预览）
 * - facets=1：附带返回年级/班级维度及各组合的用户数（用于派发面板下拉选项）
 */
const MAX_PREVIEW_COUNT = 2000

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const query = getQuery(event)
  const keyword = typeof query.q === 'string' ? query.q.trim() : ''
  const tags = typeof query.tags === 'string'
    ? [...new Set(query.tags.split(',').map((tag) => tag.trim()).filter(Boolean))]
    : []
  const grade = typeof query.grade === 'string' ? query.grade.trim() : ''
  const className = typeof query.class === 'string' ? query.class.trim() : ''
  const returnAll = query.all === '1' || query.all === 'true'
  const withFacets = query.facets === '1' || query.facets === 'true'

  const conditions = [ne(users.status, 'pending')]
  if (keyword) {
    conditions.push(or(ilike(users.name, `%${keyword}%`), ilike(users.username, `%${keyword}%`))!)
  }
  if (tags.length) {
    // 数组重叠运算：用户拥有任意一个所选标签即命中
    // 标签逐个参数化传入，避免把 JS 数组当成行记录渲染
    const tagArray = sql`ARRAY[${sql.join(tags.map((tag) => sql`${tag}`), sql`, `)}]::text[]`
    conditions.push(sql`${users.tags} && ${tagArray}`)
  }
  if (grade) {
    conditions.push(eq(users.grade, grade))
  }
  if (className) {
    conditions.push(eq(users.class, className))
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
  const hasFilter = Boolean(keyword || tags.length || grade || className)
  const limit = returnAll || hasFilter ? MAX_PREVIEW_COUNT : 30

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      grade: users.grade,
      class: users.class,
      role: users.role,
      status: users.status,
      tags: users.tags
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
