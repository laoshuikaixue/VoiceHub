import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, asc, eq, ilike, ne, or } from 'drizzle-orm'

/**
 * 派发点歌券时的接收人搜索。
 *
 * 与 /api/users/search 的区别：这里返回真实姓名与用户名（管理端派发需要核对具体对象），
 * 且排除待审核账号（未通过审核的用户无法接收点歌券）。
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
  const keyword = typeof query.q === 'string' ? query.q.trim() : ''

  const conditions = [ne(users.status, 'pending')]
  if (keyword) {
    conditions.push(or(ilike(users.name, `%${keyword}%`), ilike(users.username, `%${keyword}%`))!)
  }

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
    .where(and(...conditions))
    .orderBy(asc(users.username))
    .limit(30)

  return {
    success: true,
    data: rows
  }
})
