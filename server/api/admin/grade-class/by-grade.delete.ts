import { defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  const grade = typeof getQuery(event).grade === 'string' ? getQuery(event).grade.trim() : ''
  if (!grade) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '年级不能为空')
  }

  // 按年级批量删除配置行，删除数量写入审计
  const deleted = await db
    .delete(gradeClass)
    .where(eq(gradeClass.grade, grade))
    .returning({ id: gradeClass.id })

  await recordAdminAudit(event, 'grade-class.delete-by-grade', {
    targetType: 'grade-class',
    targetId: `batch:${deleted.length}`,
    summary: { grade, deleted: deleted.length }
  })

  return {
    success: true
  }
})