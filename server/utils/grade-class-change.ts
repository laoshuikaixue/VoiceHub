import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { gradeClassChangeLogs, semesters, users } from '~/drizzle/schema'
import { formatDateTime, getBeijingTime } from '~/utils/timeUtils'
import { getSystemSettingsCached } from './system-settings-helper'
import { evaluateGradeClassChangeRules } from './grade-class-change-policy'
import type { GradeClassChangeDecision } from './grade-class-change-policy'

export type GradeClassValue = { grade: string | null; class: string | null }

export type GradeClassChangeRecord = {
  id: number
  semester: string | null
  oldGrade: string | null
  oldClass: string | null
  newGrade: string | null
  newClass: string | null
  source: string
  changedAt: string
}

export type GradeClassSelfUpdateState = {
  enabled: boolean
  limits: {
    minIntervalDays: number | null
    perSemesterLimit: number | null
    windowStart: string | null
    windowEnd: string | null
  }
  remainingThisSemester: number | null
  lastSelfChange: GradeClassChangeRecord | null
  decision: GradeClassChangeDecision
}

const normalizePositiveInt = (value: unknown, max: number): number | null =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max ? (value as number) : null

const normalizeDateString = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null

const hasSameGradeClass = (a: GradeClassValue, b: GradeClassValue) =>
  (a.grade || null) === (b.grade || null) && (a.class || null) === (b.class || null)

export async function getCurrentSemesterName(): Promise<string | null> {
  const [row] = await db
    .select({ name: semesters.name })
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1)
  return row?.name ?? null
}

/**
 * 记录一次年级班级变更；值未变化时不写入。
 * 学生自助与管理员代改共用，便于历史与次数统计口径一致。
 * 批量改动可由调用方传入已解析的学期名，避免逐条查库。
 * 调用方在事务内改动用户信息时须传入 tx，使更新与日志原子写入。
 */
export async function recordGradeClassChange(input: {
  userId: number
  operatorId: number
  source: 'student' | 'admin'
  previous: GradeClassValue
  next: GradeClassValue
  semester?: string | null
  tx?: any
}): Promise<boolean> {
  if (hasSameGradeClass(input.previous, input.next)) return false

  const semester = input.semester !== undefined ? input.semester : await getCurrentSemesterName()
  const executor = input.tx ?? db
  await executor.insert(gradeClassChangeLogs).values({
    userId: input.userId,
    operatorId: input.operatorId,
    source: input.source,
    semester,
    oldGrade: input.previous.grade || null,
    oldClass: input.previous.class || null,
    newGrade: input.next.grade || null,
    newClass: input.next.class || null
  })
  return true
}

type ChangeLogFields = {
  id: number
  semester: string | null
  oldGrade: string | null
  oldClass: string | null
  newGrade: string | null
  newClass: string | null
  source: string
  createdAt: Date
}

const toRecord = (row: ChangeLogFields): GradeClassChangeRecord => ({
  id: row.id,
  semester: row.semester,
  oldGrade: row.oldGrade,
  oldClass: row.oldClass,
  newGrade: row.newGrade,
  newClass: row.newClass,
  source: row.source,
  changedAt: formatDateTime(row.createdAt)
})

export type GradeClassChangeWithOperator = GradeClassChangeRecord & {
  operator: { name: string | null; username: string | null }
}

/**
 * 按时间倒序读取某用户的班级变更历史（学生自助与管理员代改混排）。
 */
export async function listGradeClassChanges(
  userId: number,
  limit = 50
): Promise<GradeClassChangeWithOperator[]> {
  const rows = await db
    .select({
      id: gradeClassChangeLogs.id,
      semester: gradeClassChangeLogs.semester,
      oldGrade: gradeClassChangeLogs.oldGrade,
      oldClass: gradeClassChangeLogs.oldClass,
      newGrade: gradeClassChangeLogs.newGrade,
      newClass: gradeClassChangeLogs.newClass,
      source: gradeClassChangeLogs.source,
      createdAt: gradeClassChangeLogs.createdAt,
      operatorName: users.name,
      operatorUsername: users.username
    })
    .from(gradeClassChangeLogs)
    .leftJoin(users, eq(gradeClassChangeLogs.operatorId, users.id))
    .where(eq(gradeClassChangeLogs.userId, userId))
    .orderBy(desc(gradeClassChangeLogs.createdAt), desc(gradeClassChangeLogs.id))
    .limit(limit)

  return rows.map((row) => ({
    ...toRecord(row),
    operator: { name: row.operatorName, username: row.operatorUsername }
  }))
}

/**
 * 汇总自助修改开关、限制与实际改动情况，给出本次是否允许改班的判定。
 * 间隔判定在数据库侧用 now() 做减法，避免宿主时区与库内 UTC 墙钟混算产生偏移。
 */
export async function getGradeClassSelfUpdateState(
  userId: number
): Promise<GradeClassSelfUpdateState> {
  const settings = await getSystemSettingsCached()
  const limits = {
    minIntervalDays: normalizePositiveInt(settings?.gradeClassChangeMinIntervalDays, 3650),
    perSemesterLimit: normalizePositiveInt(settings?.gradeClassChangePerSemesterLimit, 100),
    windowStart: normalizeDateString(settings?.gradeClassChangeWindowStart),
    windowEnd: normalizeDateString(settings?.gradeClassChangeWindowEnd)
  }
  const enabled = settings?.allowStudentGradeClassUpdate === true

  const [lastSelfChangeRow] = await db
    .select()
    .from(gradeClassChangeLogs)
    .where(and(eq(gradeClassChangeLogs.userId, userId), eq(gradeClassChangeLogs.source, 'student')))
    .orderBy(desc(gradeClassChangeLogs.createdAt), desc(gradeClassChangeLogs.id))
    .limit(1)

  let intervalSatisfied = true
  if (limits.minIntervalDays) {
    const recentRows = await db
      .select({ id: gradeClassChangeLogs.id })
      .from(gradeClassChangeLogs)
      .where(
        and(
          eq(gradeClassChangeLogs.userId, userId),
          eq(gradeClassChangeLogs.source, 'student'),
          sql`${gradeClassChangeLogs.createdAt} > now() - make_interval(days => ${limits.minIntervalDays}::int)`
        )
      )
      .limit(1)
    intervalSatisfied = recentRows.length === 0
  }

  let semesterChangeCount: number | null = null
  if (limits.perSemesterLimit !== null) {
    const semesterName = await getCurrentSemesterName()
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gradeClassChangeLogs)
      .where(
        and(
          eq(gradeClassChangeLogs.userId, userId),
          eq(gradeClassChangeLogs.source, 'student'),
          semesterName
            ? eq(gradeClassChangeLogs.semester, semesterName)
            : isNull(gradeClassChangeLogs.semester)
        )
      )
    semesterChangeCount = countRow?.count ?? 0
  }

  const decision = evaluateGradeClassChangeRules({
    today: formatDateTime(getBeijingTime(), 'YYYY-MM-DD'),
    windowStart: limits.windowStart,
    windowEnd: limits.windowEnd,
    intervalSatisfied,
    semesterChangeCount: semesterChangeCount ?? 0,
    perSemesterLimit: limits.perSemesterLimit
  })

  return {
    enabled,
    limits,
    remainingThisSemester:
      semesterChangeCount === null || limits.perSemesterLimit === null
        ? null
        : Math.max(0, limits.perSemesterLimit - semesterChangeCount),
    lastSelfChange: lastSelfChangeRow ? toRecord(lastSelfChangeRow) : null,
    decision
  }
}
