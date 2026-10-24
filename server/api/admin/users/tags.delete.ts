import { db } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

/**
 * 全局删除标签：从所有用户身上移除指定标签。
 * query: ?name=标签名
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const query = getQuery(event)
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '请指定要删除的标签名' })
  }

  const result = await db.execute(sql`
    UPDATE "User"
    SET tags = array_remove(tags, ${name}), "updatedAt" = now()
    WHERE tags @> ARRAY[${name}]::text[]
  `)

  return {
    success: true,
    updatedCount: Number((result as any)?.count ?? (result as any)?.rowCount ?? 0)
  }
})
