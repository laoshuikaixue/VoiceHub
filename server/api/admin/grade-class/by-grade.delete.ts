import { defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { policies } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  await policies.canManageGradeClass(event)

  const grade = typeof getQuery(event).grade === 'string' ? getQuery(event).grade.trim() : ''
  if (!grade) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '年级不能为空')
  }

  await db.delete(gradeClass).where(eq(gradeClass.grade, grade))

  return {
    success: true
  }
})