import { defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { gradeClass } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const MAX_BATCH_SIZE = 500

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有权限访问')
  }

  const body = await readBody(event)

  // 批量模式：items 数组，已存在的组合跳过，返回新增/跳过数量
  if (Array.isArray(body?.items)) {
    if (body.items.length > MAX_BATCH_SIZE) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `单次批量最多 ${MAX_BATCH_SIZE} 项`)
    }

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
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '年级和班级不能为空')
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

  // 单条模式（插入用 onConflictDoNothing 兜底并发唯一冲突，冲突返回 409）
  const grade = typeof body.grade === 'string' ? body.grade.trim() : ''
  const studentClass = typeof body.class === 'string' ? body.class.trim() : ''

  if (!grade || !studentClass) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '年级和班级不能为空')
  }

  const inserted = (await db
    .insert(gradeClass)
    .values({ grade, class: studentClass })
    .onConflictDoNothing()
    .returning({ id: gradeClass.id, grade: gradeClass.grade, class: gradeClass.class }))[0]

  if (!inserted) {
    throw createApiError(409, SERVER_ERROR_CODES.GRADE_CLASS_DUPLICATE, '该年级班级组合已存在')
  }

  return {
    success: true,
    item: inserted
  }
})