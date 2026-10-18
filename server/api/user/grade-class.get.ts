import { defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getGradeClassSelfUpdateState, listGradeClassChanges } from '~~/server/utils/grade-class-change'
import { fetchGradeClassOptions } from '~~/server/utils/grade-class-options'

// 账号页读取自助改班的开放状态、限制参数与个人改动历史
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '请先登录')
  }

  const [row] = await db
    .select({ grade: users.grade, class: users.class })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!row) {
    throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
  }

  const state = await getGradeClassSelfUpdateState(user.id)
  const options = state.enabled ? await fetchGradeClassOptions() : []
  const history = await listGradeClassChanges(user.id, 20)

  return {
    success: true,
    data: {
      enabled: state.enabled,
      canChange: state.enabled && state.decision.allowed,
      deniedReason: state.decision.allowed ? null : state.decision.reason,
      current: { grade: row.grade, class: row.class },
      limits: state.limits,
      remainingThisSemester: state.remainingThisSemester,
      lastChange: state.lastSelfChange,
      options,
      history: history.map((item) => ({
        id: item.id,
        semester: item.semester,
        oldGrade: item.oldGrade,
        oldClass: item.oldClass,
        newGrade: item.newGrade,
        newClass: item.newClass,
        source: item.source,
        changedAt: item.changedAt,
        operatorName: item.operator.name || item.operator.username
      }))
    }
  }
})
