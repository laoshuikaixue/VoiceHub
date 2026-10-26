import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodeDispatchPlans, users } from '~/drizzle/schema'
import {
  generateAndAssignCardCodes,
  type AssignTarget
} from '~~/server/services/cardCodeAssignmentService'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 业务时区：所有「每天的几点」「周几」都按北京时间理解，与播放时段保持一致 */
const BEIJING_TIMEZONE = 'Asia/Shanghai'

/**
 * 执行抢占的失效阈值。
 * 定时器在派发中途被重启/杀进程时 runningAt 会残留，超过该时长视为失效并允许重新抢占，
 * 否则这条计划会永久卡在「执行中」。
 */
const STALE_RUNNING_MS = 10 * 60 * 1000

export const SCHEDULE_TYPES = ['once', 'daily', 'weekly', 'monthly'] as const
export type ScheduleType = (typeof SCHEDULE_TYPES)[number]

export const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const

export type DispatchPlanSchedule = {
  scheduleType: string
  startAt: Date
  endAt?: Date | null
  weekdays?: number[] | null
  dayOfMonth?: number | null
}

export type DispatchRunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

export type DispatchRunResult = {
  planId: number
  status: DispatchRunStatus
  message: string
  assignedCount: number
  failedCount: number
  servedRecipients: number
  invalidRecipients: Array<{ userId: number; reason: string }>
  generatedCodes: string[]
}

function isValidScheduleType(value: unknown): value is ScheduleType {
  return typeof value === 'string' && (SCHEDULE_TYPES as readonly string[]).includes(value)
}

/**
 * 计算下一次执行时间。
 *
 * 语义统一为「严格晚于 from 的第一个触发点」：
 * - once：仅在 startAt 尚未到来时返回 startAt，之后返回 null（计划自然结束）
 * - daily / weekly / monthly：从 max(from, startAt) 起按规则向后找
 *
 * 时间基准是 startAt 当天的「时分」，因此改期只需改 startAt 的日期部分。
 * 月底边界（如 31 号）按当月最后一天执行，不会跳过整月。
 */
export function computeNextRunAt(plan: DispatchPlanSchedule, from: Date = new Date()): Date | null {
  const startAt = new Date(plan.startAt)
  if (Number.isNaN(startAt.getTime())) return null

  const fromMs = from.getTime()
  const endMs = plan.endAt ? new Date(plan.endAt).getTime() : null
  const withinEnd = (value: number) => endMs === null || value <= endMs

  const scheduleType: ScheduleType = isValidScheduleType(plan.scheduleType) ? plan.scheduleType : 'once'

  if (scheduleType === 'once') {
    if (startAt.getTime() > fromMs && withinEnd(startAt.getTime())) return startAt
    return null
  }

  const startBJ = dayjs(startAt).tz(BEIJING_TIMEZONE)
  const hour = startBJ.hour()
  const minute = startBJ.minute()
  const base = dayjs(Math.max(fromMs, startAt.getTime())).tz(BEIJING_TIMEZONE)
  const atTime = (day: dayjs.Dayjs) => day.hour(hour).minute(minute).second(0).millisecond(0)

  if (scheduleType === 'daily') {
    for (let offset = 0; offset < 400; offset++) {
      const candidate = atTime(base.add(offset, 'day'))
      const ms = candidate.valueOf()
      if (ms > fromMs && withinEnd(ms)) return candidate.toDate()
    }
    return null
  }

  if (scheduleType === 'weekly') {
    const weekdays = [...new Set((plan.weekdays || []).map((day) => Number(day)))]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    if (!weekdays.length) return null
    for (let offset = 0; offset < 60; offset++) {
      const candidate = atTime(base.add(offset, 'day'))
      if (!weekdays.includes(candidate.day())) continue
      const ms = candidate.valueOf()
      if (ms > fromMs && withinEnd(ms)) return candidate.toDate()
    }
    return null
  }

  // monthly
  const targetDay = Number(plan.dayOfMonth)
  if (!Number.isInteger(targetDay) || targetDay < 1 || targetDay > 31) return null
  const monthStart = base.startOf('month')
  for (let offset = 0; offset < 60; offset++) {
    const month = monthStart.add(offset, 'month')
    const day = Math.min(targetDay, month.daysInMonth())
    const candidate = atTime(month.date(day))
    const ms = candidate.valueOf()
    if (ms > fromMs && withinEnd(ms)) return candidate.toDate()
  }
  return null
}

async function getPlan(planId: number) {
  const [plan] = await db
    .select()
    .from(cardCodeDispatchPlans)
    .where(eq(cardCodeDispatchPlans.id, planId))
    .limit(1)
  return plan || null
}

/**
 * 抢占执行权。
 *
 * 用 runningAt 做乐观锁：定时扫描与管理员「立即执行」可能同时命中同一条计划，
 * 只有一条能抢到。条件里带上失效阈值，避免异常中断后计划永久卡死。
 */
async function claimPlan(planId: number, now: Date): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_MS)
  const claimed = await db
    .update(cardCodeDispatchPlans)
    .set({ runningAt: now })
    .where(
      and(
        eq(cardCodeDispatchPlans.id, planId),
        or(
          isNull(cardCodeDispatchPlans.runningAt),
          lt(cardCodeDispatchPlans.runningAt, staleBefore)
        )
      )
    )
    .returning({ id: cardCodeDispatchPlans.id })
  return claimed.length > 0
}

/** 执行人：优先用计划创建者；创建者已注销时退回一位在职管理员，保证审计记录可用 */
async function resolveActor(plan: { createdBy: number | null; createdByName: string | null }) {
  if (plan.createdBy) {
    return { id: plan.createdBy, name: plan.createdByName, username: null as string | null }
  }
  const [fallback] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(inArray(users.role, ['SUPER_ADMIN', 'ADMIN']))
    .orderBy(asc(users.id))
    .limit(1)
  if (!fallback) return null
  return {
    id: fallback.id,
    name: fallback.name || '系统自动派发',
    username: fallback.username
  }
}

/** 把计划里固化的接收人快照复核一遍：已删除或未过审的用户单独列出，不阻断其他人 */
async function resolveTargets(recipientIds: number[]) {
  const ids = [...new Set(recipientIds || [])].filter((id) => Number.isInteger(id) && id > 0)
  const invalid: Array<{ userId: number; reason: string }> = []
  if (!ids.length) return { targets: [] as AssignTarget[], invalid }

  const rows = await db
    .select({ id: users.id, name: users.name, username: users.username, status: users.status })
    .from(users)
    .where(inArray(users.id, ids))
  const map = new Map(rows.map((row) => [row.id, row]))

  const targets: AssignTarget[] = []
  for (const id of ids) {
    const row = map.get(id)
    if (!row) {
      invalid.push({ userId: id, reason: '用户不存在' })
      continue
    }
    if (row.status === 'pending') {
      invalid.push({ userId: id, reason: '尚未通过审核，无法派发点歌券' })
      continue
    }
    targets.push({ id: row.id, name: row.name, username: row.username })
  }
  return { targets, invalid }
}

/** 真正执行一次派发：现场生成券并直接发给接收人 */
async function performDispatch(
  plan: typeof cardCodeDispatchPlans.$inferSelect,
  now: Date
): Promise<DispatchRunResult> {
  const base: DispatchRunResult = {
    planId: plan.id,
    status: 'FAILED',
    message: '',
    assignedCount: 0,
    failedCount: 0,
    servedRecipients: 0,
    invalidRecipients: [],
    generatedCodes: []
  }

  const actor = await resolveActor(plan)
  if (!actor) {
    return { ...base, message: '找不到可用的执行人账号（计划创建者已注销且系统内无管理员）' }
  }

  const { targets, invalid } = await resolveTargets(plan.recipientIds || [])
  if (!targets.length) {
    return {
      ...base,
      invalidRecipients: invalid,
      message: invalid.length
        ? `没有可派发的接收人：${invalid.map((item) => `#${item.userId} ${item.reason}`).join('；')}`
        : '计划未配置接收人'
    }
  }

  const result = await generateAndAssignCardCodes({
    targets,
    countPerUser: plan.countPerUser,
    actor,
    note: plan.note || `自动派发：${plan.name}`,
    notify: plan.notify,
    prefix: plan.prefix || undefined,
    cardNote: plan.note || `自动派发：${plan.name}`
  })

  const assignedCount = result.summary.assignedCount
  const failedCount = result.summary.failedCount
  const status: DispatchRunStatus = assignedCount === 0 ? 'FAILED' : failedCount > 0 ? 'PARTIAL' : 'SUCCESS'
  const parts: string[] = []
  parts.push(`成功 ${assignedCount} 张，覆盖 ${result.summary.servedRecipients} 位用户`)
  if (failedCount > 0) parts.push(`失败 ${failedCount} 张`)
  if (invalid.length) parts.push(`无效接收人 ${invalid.length} 位`)

  return {
    planId: plan.id,
    status,
    message: parts.join('，'),
    assignedCount,
    failedCount,
    servedRecipients: result.summary.servedRecipients,
    invalidRecipients: invalid,
    generatedCodes: result.generatedCodes || []
  }
}

async function finishPlan(
  plan: typeof cardCodeDispatchPlans.$inferSelect,
  now: Date,
  result: DispatchRunResult,
  options: { force?: boolean } = {}
) {
  // 单次计划被「立即执行」后就算走完了：原定时间点不能再发一次，否则会重复派发。
  // 循环计划则不动排期 —— 立即执行只是提前试跑，不影响下一次正常触发。
  const consumed = plan.scheduleType === 'once'
  const nextRunAt = consumed
    ? null
    : computeNextRunAt(
        {
          scheduleType: plan.scheduleType,
          startAt: plan.startAt,
          endAt: plan.endAt,
          weekdays: plan.weekdays || [],
          dayOfMonth: plan.dayOfMonth
        },
        now
      )

  await db
    .update(cardCodeDispatchPlans)
    .set({
      lastRunAt: now,
      nextRunAt,
      lastStatus: result.status,
      lastMessage: result.message,
      runCount: sql`${cardCodeDispatchPlans.runCount} + 1`,
      // 单次计划执行完就自然结束，不必留着一条永不触发的启用记录
      ...(consumed ? { enabled: false } : {}),
      updatedAt: now
    })
    .where(eq(cardCodeDispatchPlans.id, plan.id))
}

async function markPlanFailure(
  plan: typeof cardCodeDispatchPlans.$inferSelect,
  now: Date,
  message: string,
  options: { force?: boolean } = {}
) {
  const consumed = plan.scheduleType === 'once'
  const nextRunAt = consumed
    ? null
    : computeNextRunAt(
        {
          scheduleType: plan.scheduleType,
          startAt: plan.startAt,
          endAt: plan.endAt,
          weekdays: plan.weekdays || [],
          dayOfMonth: plan.dayOfMonth
        },
        now
      )
  await db
    .update(cardCodeDispatchPlans)
    .set({
      lastRunAt: now,
      nextRunAt,
      lastStatus: 'FAILED',
      lastMessage: message.slice(0, 500),
      ...(consumed ? { enabled: false } : {}),
      updatedAt: now
    })
    .where(eq(cardCodeDispatchPlans.id, plan.id))
}

async function clearRunning(planId: number) {
  await db
    .update(cardCodeDispatchPlans)
    .set({ runningAt: null })
    .where(eq(cardCodeDispatchPlans.id, planId))
}

/**
 * 执行一条计划。
 *
 * @param options.force 管理员点「立即执行」时为 true —— 忽略 nextRunAt 未到点的限制，
 *   但仍然走 runningAt 抢占，避免与定时器重复派发
 */
export async function executeDispatchPlan(
  planId: number,
  options: { force?: boolean } = {}
): Promise<DispatchRunResult> {
  const plan = await getPlan(planId)
  if (!plan) {
    throw createError({ statusCode: 404, message: '自动派发计划不存在' })
  }
  if (!plan.enabled && !options.force) {
    throw createError({ statusCode: 400, message: '该计划已停用' })
  }

  const now = new Date()
  if (!(await claimPlan(planId, now))) {
    throw createError({ statusCode: 409, message: '该计划正在执行中，请稍后再试' })
  }

  try {
    const result = await performDispatch(plan, now)
    await finishPlan(plan, now, result, options)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动派发执行失败'
    await markPlanFailure(plan, now, message, options)
    throw error
  } finally {
    await clearRunning(planId)
  }
}

/**
 * 扫描到点计划并执行。由 nitro 插件周期调用。
 *
 * 单条失败不影响其他计划：createError 之类的异常在这里收敛为日志，
 * 失败原因已随 markPlanFailure 落到计划记录上，管理端能看到。
 */
export async function runDueDispatchPlans(limit = 20): Promise<DispatchRunResult[]> {
  const now = new Date()
  const due = await db
    .select()
    .from(cardCodeDispatchPlans)
    .where(and(eq(cardCodeDispatchPlans.enabled, true), lte(cardCodeDispatchPlans.nextRunAt, now)))
    .orderBy(asc(cardCodeDispatchPlans.nextRunAt))
    .limit(limit)

  const results: DispatchRunResult[] = []
  for (const plan of due) {
    try {
      results.push(await executeDispatchPlan(plan.id))
    } catch (error) {
      console.error(`[点歌券自动派发] 计划 #${plan.id}（${plan.name}）执行失败:`, error)
    }
  }
  return results
}
