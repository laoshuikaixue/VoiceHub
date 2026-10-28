import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { playTimes } from '~/drizzle/schema'

/**
 * 默认播出时段的切换规则。
 *
 * 不变式：同一时间最多一个默认时段，且默认时段必须处于启用状态。
 * 数据库层由部分唯一索引 play_time_single_default_unique 兜底，
 * 这里的实现负责在事务内先清空再设置，避免并发写入撞索引。
 */

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** 清空当前默认时段。 */
export async function clearDefaultPlayTime(tx: DbTransaction): Promise<void> {
  await tx.update(playTimes).set({ isDefault: false }).where(eq(playTimes.isDefault, true))
}

/**
 * 把指定时段设为唯一默认时段。
 * 先清空其它默认再设置目标，必须在事务内调用。
 */
export async function setDefaultPlayTime(tx: DbTransaction, id: number): Promise<void> {
  await clearDefaultPlayTime(tx)
  await tx.update(playTimes).set({ isDefault: true }).where(eq(playTimes.id, id))
}
