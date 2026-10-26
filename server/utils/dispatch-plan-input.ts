import { SCHEDULE_TYPES, type ScheduleType } from '~~/server/services/dispatchPlanService'
import { parseToBeijingTime } from '~/utils/timeUtils'

/**
 * 自动派发计划的入参规范化与校验。
 *
 * 创建与更新共用一份校验，避免两条路径对「什么算合法计划」判断不一致：
 * 前端漏传某个字段时，宁可报错让管理员补齐，也不要静默用默认值发错券。
 */
export type NormalizedDispatchPlan = {
  name: string
  countPerUser: number
  recipientIds: number[]
  note: string | null
  notify: boolean
  prefix: string | null
  scheduleType: ScheduleType
  startAt: Date
  endAt: Date | null
  weekdays: number[]
  dayOfMonth: number | null
}

const MAX_RECIPIENTS = 2000
const MAX_COUNT_PER_USER = 100
// 每人张数 × 人数 的上限，与手动派发的生成上限保持一致
const MAX_TOTAL_CODES = 1000

function fail(message: string): never {
  throw createError({ statusCode: 400, message })
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fail(`${field}不是有效时间`) : value
  const raw = String(value).trim()
  // 带时区标记的按标记解析；不带时区的裸时间（如 2026-10-27T20:00）一律按北京时间理解，
  // 避免服务端本地时区为 UTC 时整体偏移 8 小时
  const withTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const date = withTz ? new Date(raw) : parseToBeijingTime(raw)
  if (Number.isNaN(date.getTime())) fail(`${field}不是有效时间`)
  return date
}

export function normalizeDispatchPlanInput(body: any): NormalizedDispatchPlan {
  const raw = body || {}

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) fail('请填写计划名称')
  if (name.length > 60) fail('计划名称不能超过 60 个字符')

  const countPerUser = Number(raw.countPerUser)
  if (!Number.isInteger(countPerUser) || countPerUser < 1 || countPerUser > MAX_COUNT_PER_USER) {
    fail(`每人派发张数需为 1-${MAX_COUNT_PER_USER} 的整数`)
  }

  const rawIds: unknown[] = Array.isArray(raw.recipientIds) ? raw.recipientIds : []
  const recipientIds = [
    ...new Set(rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  ]
  if (!recipientIds.length) fail('请至少选择一位接收人')
  if (recipientIds.length > MAX_RECIPIENTS) fail(`单条计划最多包含 ${MAX_RECIPIENTS} 位接收人`)
  if (recipientIds.length * countPerUser > MAX_TOTAL_CODES) {
    fail(`单次执行最多生成 ${MAX_TOTAL_CODES} 张点歌券，请减少接收人或每人张数`)
  }

  const scheduleType = String(raw.scheduleType || 'once') as ScheduleType
  if (!(SCHEDULE_TYPES as readonly string[]).includes(scheduleType)) {
    fail('执行规则不合法')
  }

  const startAt = parseDate(raw.startAt, '执行时间')
  if (!startAt) fail('请选择执行时间')

  const endAt = parseDate(raw.endAt, '结束时间')
  if (endAt && endAt.getTime() <= startAt.getTime()) {
    fail('结束时间必须晚于首次执行时间')
  }

  let weekdays: number[] = []
  if (scheduleType === 'weekly') {
    const rawDays: unknown[] = Array.isArray(raw.weekdays) ? raw.weekdays : []
    weekdays = [
      ...new Set(
        rawDays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      )
    ].sort((a, b) => a - b)
    if (!weekdays.length) fail('每周执行至少选择一天')
  }

  let dayOfMonth: number | null = null
  if (scheduleType === 'monthly') {
    const day = Number(raw.dayOfMonth)
    if (!Number.isInteger(day) || day < 1 || day > 31) fail('每月执行日需为 1-31')
    dayOfMonth = day
  }

  const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 200) : null
  const prefix = typeof raw.prefix === 'string' && raw.prefix.trim()
    ? raw.prefix.trim().toUpperCase().slice(0, 12)
    : null

  return {
    name,
    countPerUser,
    recipientIds,
    note,
    notify: raw.notify !== false,
    prefix,
    scheduleType,
    startAt,
    endAt,
    weekdays,
    dayOfMonth
  }
}

/** 复用一个权限判断，避免每个 handler 各写一遍 */
export function assertCardCodeAdmin(user: any) {
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }
  return user
}
