import { defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有权限访问')
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的配置 ID')
  }

  const existing = await db.query.gradeClass.findFirst({
    where: eq(gradeClass.id, id),
    columns: { id: true }
  })

  if (!existing) {
    throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '配置项不存在')
  }

  // 仅删除配置行，不触碰任何用户数据
  await db.delete(gradeClass).where(eq(gradeClass.id, id))

  return {
    success: true,
    message: '配置项已删除'
  }
})