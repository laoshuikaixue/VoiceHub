import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { eq, and, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理学期'
    })
  }

  const semesterId = parseInt(event.context.params?.id || '0')

  if (!semesterId || isNaN(semesterId)) {
    throw createError({
      statusCode: 400,
      message: '无效的学期ID'
    })
  }

  const body = await readBody(event)

  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: '学期名称不能为空'
    })
  }

  // 检查学期是否存在
  const currentSemesterResult = await db
    .select()
    .from(semesters)
    .where(eq(semesters.id, semesterId))
    .limit(1)
  
  if (currentSemesterResult.length === 0) {
    throw createError({
      statusCode: 404,
      message: '学期不存在'
    })
  }

  // 检查新名称是否与其他学期冲突
  const existingSemesterResult = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.name, body.name),
        ne(semesters.id, semesterId)
      )
    )
    .limit(1)

  if (existingSemesterResult.length > 0) {
    throw createError({
      statusCode: 400,
      message: '该学期名称已存在'
    })
  }

  // 更新学期名称
  const updateResult = await db
    .update(semesters)
    .set({ name: body.name })
    .where(eq(semesters.id, semesterId))
    .returning()

  return updateResult[0]
})
