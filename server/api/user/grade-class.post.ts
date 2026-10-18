import { defineEventHandler, readBody, setResponseHeader } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { isGradeClassValid } from '~~/server/utils/grade-class-options'
import {
  getGradeClassSelfUpdateState,
  recordGradeClassChange
} from '~~/server/utils/grade-class-change'
import type { GradeClassChangeDeniedReason } from '~~/server/utils/grade-class-change-policy'

const SELF_UPDATE_LIMIT = 5
const SELF_UPDATE_WINDOW_MS = 3600000

const deniedReasonCodes: Record<GradeClassChangeDeniedReason, string> = {
  window_closed: SERVER_ERROR_CODES.GRADE_CLASS_WINDOW_CLOSED,
  interval_pending: SERVER_ERROR_CODES.GRADE_CLASS_INTERVAL_PENDING,
  semester_limit_reached: SERVER_ERROR_CODES.GRADE_CLASS_SEMESTER_LIMIT_REACHED
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

// 学生自助修改本人年级班级
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '请先登录')
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const grade = normalizeText(body?.grade)
  const studentClass = normalizeText(body?.class)

  if (!grade || !studentClass) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '年级和班级均为必填项')
  }

  const rateLimit = await checkDistributedRateLimit(
    `grade-class:self-update:user:${user.id}`,
    SELF_UPDATE_LIMIT,
    SELF_UPDATE_WINDOW_MS
  )
  if (!rateLimit.isAllowed) {
    const waitSeconds = Math.max(1, Math.ceil((rateLimit.resetTime - getServerTimestamp()) / 1000))
    setResponseHeader(event, 'Retry-After', String(waitSeconds))
    throw createApiError(
      429,
      SERVER_ERROR_CODES.AUTH_RATE_LIMITED_SECONDS,
      `修改过于频繁，请 ${waitSeconds} 秒后再试`,
      { params: [waitSeconds] }
    )
  }

  const [current] = await db
    .select({ grade: users.grade, class: users.class })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!current) {
    throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
  }

  const state = await getGradeClassSelfUpdateState(user.id)
  if (!state.enabled) {
    throw createApiError(403, SERVER_ERROR_CODES.GRADE_CLASS_SELF_UPDATE_DISABLED, '未开放自助修改班级')
  }
  if (!state.decision.allowed) {
    const code = deniedReasonCodes[state.decision.reason]
    throw createApiError(403, code, '当前不满足自助修改班级的条件')
  }

  // 与注册表单同源：只接受管理员配置的年级班级组合，学生无法自造班级
  if (!(await isGradeClassValid(grade, studentClass))) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_GRADE_CLASS_MUST_EXIST, '请选择系统内已存在的年级和班级')
  }

  if (grade === (current.grade || '') && studentClass === (current.class || '')) {
    throw createApiError(400, SERVER_ERROR_CODES.GRADE_CLASS_UNCHANGED, '所选年级班级与当前一致')
  }

  await db
    .update(users)
    .set({ grade, class: studentClass })
    .where(eq(users.id, user.id))

  await recordGradeClassChange({
    userId: user.id,
    operatorId: user.id,
    source: 'student',
    previous: { grade: current.grade, class: current.class },
    next: { grade, class: studentClass }
  })

  const nextState = await getGradeClassSelfUpdateState(user.id)

  return {
    success: true,
    message: '年级班级已更新',
    data: {
      current: { grade, class: studentClass },
      canChange: nextState.enabled && nextState.decision.allowed,
      deniedReason: nextState.decision.allowed ? null : nextState.decision.reason,
      remainingThisSemester: nextState.remainingThisSemester,
      lastChange: nextState.lastSelfChange
    }
  }
})
