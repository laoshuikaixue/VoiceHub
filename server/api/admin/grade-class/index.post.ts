import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const body = await readBody(event)

  // 批量模式：items 数组，已存在的组合跳过，返回新增/跳过数量
  if (Array.isArray(body?.items)) {
    const pairs = body.items
      .map((item) => ({
        grade: typeof item?.grade === 'string' ? item.grade.trim() : '',
        class: typeof item?.class === 'string' ? item.class.trim() : ''
      }))
      .filter((item) => item.grade && item.class)

    const seen = new Set<string>()
    const uniquePairs = pairs.filter((item) => {
      const key = `${item.grade}\u0000${item.class}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (uniquePairs.length === 0) {
      throw createError({
        statusCode: 400,
        message: '年级和班级不能为空'
      })
    }

    const existingRows = await db
      .select({ grade: gradeClass.grade, class: gradeClass.class })
      .from(gradeClass)
    const existingKeys = new Set(existingRows.map((row) => `${row.grade}\u0000${row.class}`))

    const toInsert = uniquePairs.filter((item) => !existingKeys.has(`${item.grade}\u0000${item.class}`))
    const skipped = uniquePairs.length - toInsert.length

    if (toInsert.length > 0) {
    // onConflictDoNothing 兜底并发下的唯一约束冲突（预查已跳过存量，此处防竞态）
    await db.insert(gradeClass).values(toInsert).onConflictDoNothing()
  }

    return {
      success: true,
      added: toInsert.length,
      skipped
    }
  }

  // 单条模式
  const grade = typeof body.grade === 'string' ? body.grade.trim() : ''
  const studentClass = typeof body.class === 'string' ? body.class.trim() : ''

  if (!grade || !studentClass) {
    throw createError({
      statusCode: 400,
      message: '年级和班级不能为空'
    })
  }

  // 重复组合拦截
  const existing = await db.query.gradeClass.findFirst({
    where: (t, { eq, and }) => and(eq(t.grade, grade), eq(t.class, studentClass)),
    columns: { id: true }
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      message: '该年级班级组合已存在'
    })
  }

  const inserted = (await db
    .insert(gradeClass)
    .values({ grade, class: studentClass })
    .returning({ id: gradeClass.id, grade: gradeClass.grade, class: gradeClass.class }))[0]

  return {
    success: true,
    item: inserted
  }
})