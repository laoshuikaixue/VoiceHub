import { defineEventHandler } from 'h3'
import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { gradeClass, users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const MAX_BATCH_SIZE = 500

// 从现有用户提取年级班级组合并写入配置（仅 active 用户）
export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有权限访问')
  }

  const userCombos = await db
    .selectDistinct({
      grade: users.grade,
      class: users.class
    })
    .from(users)
    .where(and(eq(users.status, 'active'), isNotNull(users.grade), isNotNull(users.class)))

  const pairs = userCombos
    .map((item) => ({
      grade: typeof item.grade === 'string' ? item.grade.trim() : '',
      class: typeof item.class === 'string' ? item.class.trim() : ''
    }))
    .filter((item) => item.grade && item.class)

  const seen = new Set<string>()
  const uniquePairs = pairs.filter((item) => {
    const key = `${item.grade}\u0000${item.class}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const existingRows = await db
    .select({ grade: gradeClass.grade, class: gradeClass.class })
    .from(gradeClass)
  const existingKeys = new Set(existingRows.map((row) => `${row.grade}\u0000${row.class}`))
  const toInsert = uniquePairs.filter((item) => !existingKeys.has(`${item.grade}\u0000${item.class}`))

  let added = 0
  for (let i = 0; i < toInsert.length; i += MAX_BATCH_SIZE) {
    const batch = toInsert.slice(i, i + MAX_BATCH_SIZE)
    const inserted = await db
      .insert(gradeClass)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: gradeClass.id })
    added += inserted.length
  }

  return {
    success: true,
    total: uniquePairs.length,
    added,
    skipped: uniquePairs.length - added
  }
})
