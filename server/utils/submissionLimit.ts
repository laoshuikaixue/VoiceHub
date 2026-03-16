import { db, songs } from '~/drizzle/db'
import { and, eq, gte, lte, count } from 'drizzle-orm'
import {
  getBeijingEndOfDay,
  getBeijingEndOfWeek,
  getBeijingEndOfMonth,
  getBeijingStartOfDay,
  getBeijingStartOfWeek,
  getBeijingStartOfMonth
} from '~/utils/timeUtils'

export type LimitType = 'daily' | 'weekly' | 'monthly'

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
 * 检查用户是否达到投稿限额
 * @param dbOrTx 数据库实例或事务
 * @param userId 用户ID
 * @param type 限额类型
 * @param limit 限额数量
 * @returns boolean true 表示已达到限额（不允许继续投稿），false 表示未达到
 */
export async function isLimitReached(
  dbOrTx: typeof db,
  userId: number,
  type: LimitType,
  limit: number
): Promise<boolean> {
  const { start, end } = getTimeRange(type)

  const [result] = await dbOrTx
    .select({ count: count() })
    .from(songs)
    .where(
      and(
        eq(songs.requesterId, userId),
        gte(songs.createdAt, start),
        lte(songs.createdAt, end)
      )
    )

  return result.count >= limit
}
