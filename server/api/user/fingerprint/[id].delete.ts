import { defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db, browserFingerprints } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 删除自己账号下的一条浏览器指纹数据
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要登录才能删除')
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的记录ID')
  }

  const result = await db
    .delete(browserFingerprints)
    .where(and(eq(browserFingerprints.id, id), eq(browserFingerprints.userId, user.id)))
    .returning({ id: browserFingerprints.id })

  if (result.length === 0) {
    throw createApiError(
      404,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_NOT_FOUND,
      '记录不存在或已被移除'
    )
  }

  return { success: true }
})
