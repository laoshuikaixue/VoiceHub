import { db } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

/**
 * 列出全部用户标签及使用人数。
 * 供派发面板「按标签派发」与标签管理弹窗使用。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const rows = await db.execute(sql`
    SELECT tag AS name, count(*)::int AS "userCount"
    FROM "User", unnest(tags) AS tag
    WHERE tag IS NOT NULL AND tag <> ''
    GROUP BY tag
    ORDER BY count(*) DESC, tag ASC
  `)

  // postgres-js 的 execute 直接返回行数组（node-postgres 才是 { rows } 结构）
  const list: any[] = Array.isArray(rows) ? rows : ((rows as any)?.rows || [])

  return {
    success: true,
    data: list.map((row: any) => ({
      name: String(row.name),
      userCount: Number(row.userCount || 0)
    }))
  }
})
