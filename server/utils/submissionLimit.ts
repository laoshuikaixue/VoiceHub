import { db, songs } from '~/drizzle/db'
import { and, count, eq, gte, isNull, lte } from 'drizzle-orm'
import {
  getBeijingEndOfDay,
  getBeijingEndOfWeek,
  getBeijingEndOfMonth,
  getBeijingStartOfDay,
  getBeijingStartOfWeek,
  getBeijingStartOfMonth
} from '~/utils/timeUtils'

export type LimitType = 'daily' | 'weekly' | 'monthly'

type SubmissionCountOptions = {
  excludeCardCodeRequests?: boolean
}

type CardCodeLimitSettings = {
  enableSubmissionLimit?: boolean | null
  enableCardCodeRequests?: boolean | null
  requireCardCodeForRequests?: boolean | null
  enableCardCodeLimitBypass?: boolean | null
}

export function isCardCodeLimitBypassActive(
  settings: CardCodeLimitSettings | null | undefined
): boolean {
  return !!(
    settings?.enableSubmissionLimit &&
    settings.enableCardCodeLimitBypass &&
    settings.enableCardCodeRequests === true
  )
}

/**
 * 获取指定限额类型的时间窗口（北京时间）
 * @param type 限额类型
 * @returns { start: Date, end: Date }
 */
export function getTimeRange(type: LimitType) {
  switch (type) {
    case 'weekly':
      return {
        start: getBeijingStartOfWeek(),
        end: getBeijingEndOfWeek()
      }
    case 'monthly':
      return {
        start: getBeijingStartOfMonth(),
        end: getBeijingEndOfMonth()
      }
    case 'daily':
    default:
      // 'daily' 是默认情况，为保证健壮性处理任何意外值。
      return {
        start: getBeijingStartOfDay(),
        end: getBeijingEndOfDay()
      }
  }
}

/**
 * 获取用户在指定周期内的投稿数量
 * @param dbOrTx 数据库实例或事务
 * @param userId 用户ID
 * @param type 限额类型
 * @param options 投稿统计选项
 * @returns 投稿数量
 */
export async function getSubmissionCount(
  dbOrTx: typeof db,
  userId: number,
  type: LimitType,
  options: SubmissionCountOptions = {}
): Promise<number> {
  const { start, end } = getTimeRange(type)

  const [result] = await dbOrTx
    .select({ count: count() })
    .from(songs)
    .where(
      and(
        eq(songs.requesterId, userId),
        gte(songs.createdAt, start),
        lte(songs.createdAt, end),
        options.excludeCardCodeRequests ? isNull(songs.cardCodeId) : undefined
      )
    )

  return result?.count || 0
}

/**
 * 检查用户是否达到投稿限额
 * @param dbOrTx 数据库实例或事务
 * @param userId 用户ID
 * @param type 限额类型
 * @param limit 限额数量
 * @param options 投稿统计选项
 * @returns boolean true 表示已达到限额（不允许继续投稿），false 表示未达到
 */
export async function isLimitReached(
  dbOrTx: typeof db,
  userId: number,
  type: LimitType,
  limit: number,
  options: SubmissionCountOptions = {}
): Promise<boolean> {
  return (await getSubmissionCount(dbOrTx, userId, type, options)) >= limit
}

export type GlobalSubmissionLimit = {
  type: LimitType
  limit: number
}

type GlobalSubmissionLimitSettings = {
  enableGlobalSubmissionLimit?: boolean | null
  globalDailySubmissionLimit?: number | null
  globalWeeklySubmissionLimit?: number | null
  globalMonthlySubmissionLimit?: number | null
}

/**
 * 解析生效的全站投稿总量限额。三个周期相互独立、可叠加生效，
 * 值为 null 表示该周期不限制。
 */
export function getActiveGlobalSubmissionLimits(
  settings: GlobalSubmissionLimitSettings | null | undefined
): GlobalSubmissionLimit[] {
  if (!settings?.enableGlobalSubmissionLimit) {
    return []
  }

  const candidates: Array<[LimitType, number | null | undefined]> = [
    ['daily', settings.globalDailySubmissionLimit],
    ['weekly', settings.globalWeeklySubmissionLimit],
    ['monthly', settings.globalMonthlySubmissionLimit]
  ]

  return candidates
    .filter(([, limit]) => limit !== null && limit !== undefined)
    .map(([type, limit]) => ({ type, limit: limit as number }))
}

/**
 * 获取全站（不区分用户）在指定周期内的投稿总量
 */
export async function getGlobalSubmissionCount(
  dbOrTx: typeof db,
  type: LimitType
): Promise<number> {
  const { start, end } = getTimeRange(type)

  const [result] = await dbOrTx
    .select({ count: count() })
    .from(songs)
    .where(and(gte(songs.createdAt, start), lte(songs.createdAt, end)))

  return result?.count || 0
}

/**
 * 查找首个已达成的全站限额（含限额为 0 的完全关闭情形）
 * @returns 已达成的限额；全部未达上限时返回 null
 */
export async function findReachedGlobalSubmissionLimit(
  dbOrTx: typeof db,
  settings: GlobalSubmissionLimitSettings | null | undefined
): Promise<GlobalSubmissionLimit | null> {
  for (const activeLimit of getActiveGlobalSubmissionLimits(settings)) {
    if ((await getGlobalSubmissionCount(dbOrTx, activeLimit.type)) >= activeLimit.limit) {
      return activeLimit
    }
  }

  return null
}

/**
 * 在已持有全局锁的事务内，判断再写入 addCount 首是否会突破任一生效的全站限额。
 * 用于批量写入（如往期导入）预留名额，防止一次插入多首绕过上限。
 * addCount 为 1 时等价于 findReachedGlobalSubmissionLimit 的判定。
 * @returns 会被突破的限额；均不突破时返回 null
 */
export async function findExceededGlobalSubmissionLimit(
  dbOrTx: typeof db,
  settings: GlobalSubmissionLimitSettings | null | undefined,
  addCount: number
): Promise<GlobalSubmissionLimit | null> {
  for (const activeLimit of getActiveGlobalSubmissionLimits(settings)) {
    const currentCount = await getGlobalSubmissionCount(dbOrTx, activeLimit.type)
    if (currentCount + addCount > activeLimit.limit) {
      return activeLimit
    }
  }

  return null
}
