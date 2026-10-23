import { defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db, browserFingerprints, users } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 管理员撤销任意账号的浏览器指纹绑定
export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser || !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      '没有权限执行该操作'
    )
  }

  const userId = Number(getRouterParam(event, 'id'))
  const fingerprintId = Number(getRouterParam(event, 'fpId'))
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(fingerprintId) || fingerprintId <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的参数')
  }

  // 确认目标账号存在，避免撤销后仍显示僵尸账号数据
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true }
  })
  if (!targetUser) {
    throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
  }

  const result = await db
    .delete(browserFingerprints)
    .where(
      and(
        eq(browserFingerprints.id, fingerprintId),
        eq(browserFingerprints.userId, userId)
      )
    )
    .returning({ id: browserFingerprints.id })

  if (result.length === 0) {
    throw createApiError(
      404,
      SERVER_ERROR_CODES.AUTH_FINGERPRINT_NOT_FOUND,
      '绑定不存在或已被移除'
    )
  }

  return { success: true }
})
