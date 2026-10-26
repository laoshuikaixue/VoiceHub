import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodeDispatchPlans, cardCodeDispatchRuns, users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
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
 * 抢占后 runningAt 会残留到本次执行结束；超过该阈值视为上一次执行异常中断，
 * 允许重新抢占，避免计划永久卡在「执行中」。
 * 注意：一次执行的超时窗口不能超过该阈值，否则可能与下一个实例重复抢占。
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

/** 自动派发执行历史的触发来源 */
export type DispatchTriggerSource = 'SCHEDULED' | 'CRON' | 'MANUAL'

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
    // 同时满足「晚于 from」与「不早于首次执行时间」：否则当月执行日在 startAt 之前时，
    // 会被算出一个比管理员选的首次执行时间更早的落位
    if (ms > fromMs && ms >= startAt.getTime() && withinEnd(ms)) return candidate.toDate()
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
 * 抢占一次执行权，并在同一条条件更新里把游标推到下一次。
 *
 * 多实例部署、定时扫描与管理员「立即执行」同时命中同一条计划时，只有全部条件都成立的
 * 一次 UPDATE 能抢到。到点执行会顺带把 nextRunAt 推到下一次（单次计划置空并停用），
 * 因此即使本次派发到一半被打断，下一轮扫描也不会把同一批券重复发出去。
 * 手动 force 只占住 runningAt 防并发，不挪用循环计划的排期。
 */
async function claimPlanOccurrence(
  plan: typeof cardCodeDispatchPlans.$inferSelect,
  now: Date,
  options: { force: boolean }
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_MS)

  // 单次计划只要真实跑过一轮就消耗掉（含试跑），避免试跑后到点再发一次
  let patch: Record<string, unknown> = { runningAt: now, updatedAt: now }
  if (plan.scheduleType === 'once') {
    patch = { ...patch, nextRunAt: null, enabled: false }
  } else if (!options.force) {
    const next = computeNextRunAt(
      {
        scheduleType: plan.scheduleType,
        startAt: plan.startAt,
        endAt: plan.endAt,
        weekdays: plan.weekdays || [],
        dayOfMonth: plan.dayOfMonth
      },
      now
    )
    // 算不出下一次 = 已过 endAt 或规则失效，同时停用避免计划静默挂着
    patch = { ...patch, nextRunAt: next, ...(next === null ? { enabled: false } : {}) }
  }

  const claimed = await db
    .update(cardCodeDispatchPlans)
    .set(patch)
    .where(
      and(
        eq(cardCodeDispatchPlans.id, plan.id),
        ...(options.force
          ? []
          : [eq(cardCodeDispatchPlans.enabled, true), lte(cardCodeDispatchPlans.nextRunAt, now)]),
        or(isNull(cardCodeDispatchPlans.runningAt), lt(cardCodeDispatchPlans.runningAt, staleBefore))
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

async function recordPlanOutcome(
  planId: number,
  runId: number | null,
  now: Date,
  result: Pick<DispatchRunResult, 'status' | 'message' | 'assignedCount' | 'failedCount' | 'servedRecipients'>
) {
  // 游标已在抢占时推好，这里只回写本次结果与执行历史
  await db
    .update(cardCodeDispatchPlans)
    .set({
      lastRunAt: now,
      lastStatus: result.status,
      lastMessage: result.message.slice(0, 500),
      runCount: sql`${cardCodeDispatchPlans.runCount} + 1`,
      updatedAt: now
    })
    .where(eq(cardCodeDispatchPlans.id, planId))

  if (runId) {
    await db
      .update(cardCodeDispatchRuns)
      .set({
        finishedAt: now,
        status: result.status,
        assignedCount: result.assignedCount,
        failedCount: result.failedCount,
        servedRecipients: result.servedRecipients,
        message: result.message.slice(0, 500)
      })
      .where(eq(cardCodeDispatchRuns.id, runId))
  }
}

async function markPlanFailure(
  planId: number,
  runId: number | null,
  now: Date,
  message: string
) {
  await db
    .update(cardCodeDispatchPlans)
    .set({
      lastRunAt: now,
      lastStatus: 'FAILED',
      lastMessage: message.slice(0, 500),
      runCount: sql`${cardCodeDispatchPlans.runCount} + 1`,
      updatedAt: now
    })
    .where(eq(cardCodeDispatchPlans.id, planId))

  if (runId) {
    await db
      .update(cardCodeDispatchRuns)
      .set({ finishedAt: now, status: 'FAILED', message: message.slice(0, 500) })
      .where(eq(cardCodeDispatchRuns.id, runId))
  }
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
 *   但仍走抢占避免与定时器重复派发；单次计划无论是否 force，跑过一轮就消耗掉排期。
 */
export async function executeDispatchPlan(
  planId: number,
  options: { force?: boolean; triggerSource?: DispatchTriggerSource } = {}
): Promise<DispatchRunResult> {
  const force = options.force === true
  const triggerSource = options.triggerSource || (force ? 'MANUAL' : 'SCHEDULED')

  const plan = await getPlan(planId)
  if (!plan) {
    throw createError({ statusCode: 404, message: '自动派发计划不存在' })
  }
  if (!plan.enabled && !force) {
    throw createError({ statusCode: 400, message: '该计划已停用' })
  }

  const now = getServerDate()
  if (!(await claimPlanOccurrence(plan, now, { force }))) {
    throw createError({
      statusCode: 409,
      message: force ? '该计划正在执行中，请稍后再试' : '该计划已被其他实例领取或尚未到点'
    })
  }

  const [run] = await db
    .insert(cardCodeDispatchRuns)
    .values({
      planId: plan.id,
      planName: plan.name,
      triggerSource,
      startedAt: now,
      status: 'RUNNING'
    })
    .returning({ id: cardCodeDispatchRuns.id })

  try {
    const result = await performDispatch(plan, now)
    await recordPlanOutcome(plan.id, run?.id ?? null, now, result)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动派发执行失败'
    await markPlanFailure(plan.id, run?.id ?? null, now, message)
    throw error
  } finally {
    await clearRunning(plan.id)
  }
}

/**
 * 扫描到点计划并执行。
 *
 * 由管理员手动触发（后台「扫描到期计划」按钮）调用，不设后台自动任务。
 * 单条失败不影响其他计划：异常在这里收敛为日志，失败原因已落到计划与执行历史。
 */
export async function runDueDispatchPlans(
  options: { limit?: number; triggerSource?: DispatchTriggerSource } = {}
): Promise<DispatchRunResult[]> {
  const limit = options.limit ?? 20
  const now = getServerDate()
  const due = await db
    .select()
    .from(cardCodeDispatchPlans)
    .where(and(eq(cardCodeDispatchPlans.enabled, true), lte(cardCodeDispatchPlans.nextRunAt, now)))
    .orderBy(asc(cardCodeDispatchPlans.nextRunAt))
    .limit(limit)

  const results: DispatchRunResult[] = []
  for (const plan of due) {
    try {
      results.push(await executeDispatchPlan(plan.id, { triggerSource: options.triggerSource }))
    } catch (error) {
      console.error(`[点歌券自动派发] 计划 #${plan.id}（${plan.name}）执行失败:`, error)
    }
  }
  return results
}
