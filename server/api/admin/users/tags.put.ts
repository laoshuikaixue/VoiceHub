import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { sql } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const MAX_TAG_LENGTH = 20

/**
 * 全局重命名标签：把所有用户身上的旧标签名替换为新名字。
 * body: { from: string, to: string }
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '权限不足')
  }

  const body = (await readBody(event)) || {}
  const from = typeof body.from === 'string' ? body.from.trim() : ''
  const to = typeof body.to === 'string' ? body.to.trim() : ''

  if (!from || !to) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请填写原标签名与新标签名')
  }
  if (from.length > MAX_TAG_LENGTH || to.length > MAX_TAG_LENGTH) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `标签名长度不能超过 ${MAX_TAG_LENGTH} 个字符`)
  }
  if (from === to) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '新标签名与原标签名相同')
  }

  const result = await db.update(users).set({
    tags: sql`ARRAY(
      SELECT DISTINCT t FROM unnest(array_replace(${users.tags}, ${from}, ${to})) AS t
      WHERE t IS NOT NULL AND t <> ''
    )`,
    updatedAt: getServerDate()
  }).where(sql`${users.tags} @> ARRAY[${from}]::text[]`).returning({ id: users.id })

  return {
    success: true,
    updatedCount: result.length
  }
})
