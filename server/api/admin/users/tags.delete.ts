import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { sql } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

/**
 * 全局删除标签：从所有用户身上移除指定标签。
 * query: ?name=标签名
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '权限不足')
  }

  const query = getQuery(event)
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  if (!name) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请指定要删除的标签名')
  }

  const result = await db.update(users).set({
    tags: sql`array_remove(${users.tags}, ${name})`,
    updatedAt: getServerDate()
  }).where(sql`${users.tags} @> ARRAY[${name}]::text[]`).returning({ id: users.id })

  return {
    success: true,
    updatedCount: result.length
  }
})
