import { createError, defineEventHandler, getRouterParam } from 'h3'
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

  const id = parseInt(getRouterParam(event, 'id'))

  const existing = await db.query.gradeClass.findFirst({
    where: eq(gradeClass.id, id),
    columns: { id: true }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: '配置项不存在'
    })
  }

  // 仅删除配置行，不触碰任何用户数据
  await db.delete(gradeClass).where(eq(gradeClass.id, id))

  return {
    success: true,
    message: '配置项已删除'
  }
})