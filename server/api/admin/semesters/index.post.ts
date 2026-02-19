import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

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

  const body = await readBody(event)

  if (!body.name) {
    throw createError({
      statusCode: 400,
      message: '学期名称不能为空'
    })
  }

  // 检查学期名称是否已存在
  const existingSemesterResult = await db
    .select()
    .from(semesters)
    .where(eq(semesters.name, body.name))
    .limit(1)
  const existingSemester = existingSemesterResult[0]

  if (existingSemester) {
    throw createError({
      statusCode: 400,
      message: '该学期名称已存在'
    })
  }

  // 检查是否是第一个学期，如果是，强制设为活跃
  const allSemestersCount = await db.select({ id: semesters.id }).from(semesters).limit(1)
  let shouldBeActive = body.isActive

  if (allSemestersCount.length === 0) {
    shouldBeActive = true
  }

  // 如果设置为活跃学期，先将其他学期设为非活跃
  if (shouldBeActive) {
    await db.update(semesters).set({ isActive: false }).where(eq(semesters.isActive, true))
  }

  // 创建新学期
  const semesterResult = await db
    .insert(semesters)
    .values({
      name: body.name,
      isActive: shouldBeActive || false
    })
    .returning()
  const semester = semesterResult[0]

  return semester
})
