import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const grade = typeof getQuery(event).grade === 'string' ? getQuery(event).grade.trim() : ''
  if (!grade) {
    throw createError({
      statusCode: 400,
      message: '年级不能为空'
    })
  }

  await db.delete(gradeClass).where(eq(gradeClass.grade, grade))

  return {
    success: true
  }
})