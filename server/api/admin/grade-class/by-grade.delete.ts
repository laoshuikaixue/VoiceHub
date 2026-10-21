import { defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canManageGradeClass } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：grade_class.manage（ADMIN 及以上）
  await canManageGradeClass(event)

  const grade = typeof getQuery(event).grade === 'string' ? getQuery(event).grade.trim() : ''
  if (!grade) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '年级不能为空')
  }

  await db.delete(gradeClass).where(eq(gradeClass.grade, grade))

  return {
    success: true
  }
})
