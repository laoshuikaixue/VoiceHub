import { randomUUID } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { SYSTEM_SETTINGS_DEFAULTS } from './system-settings-defaults'

let cachedInstanceId: string | null = null
let pendingInstanceIdPromise: Promise<string> | null = null

const loadOrCreateInstanceId = async (): Promise<string> => {
  const settingsResult = await db
    .select({ id: systemSettings.id, instanceId: systemSettings.instanceId })
    .from(systemSettings)
    .orderBy(asc(systemSettings.id))
    .limit(1)

  const settings = settingsResult[0]

  if (settings?.instanceId) {
    return settings.instanceId
  }

  const instanceId = randomUUID()

  if (!settings) {
    // 强制使用单行记录（id=1），避免并发冷启动插入时产生重复数据
    await db
      .insert(systemSettings)
      .values({ id: 1, ...SYSTEM_SETTINGS_DEFAULTS, instanceId })
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: { instanceId, updatedAt: new Date() }
      })

    // 手动指定 serial 主键后重置序列，避免后续自动插入时发生唯一约束冲突
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('"SystemSettings"', 'id'), (SELECT MAX(id) FROM "SystemSettings"))
    `)
  } else {
    await db
      .update(systemSettings)
      .set({ instanceId, updatedAt: new Date() })
      .where(eq(systemSettings.id, settings.id))
  }

  return instanceId
}

export const getInstanceId = async (): Promise<string> => {
  if (cachedInstanceId) {
    return cachedInstanceId
  }

  if (!pendingInstanceIdPromise) {
    pendingInstanceIdPromise = loadOrCreateInstanceId()
      .then((instanceId) => {
        cachedInstanceId = instanceId
        return instanceId
      })
      .catch((error) => {
        // 使用备用 UUID 但不缓存为最终结果，允许下次调用时重试
        const fallbackInstanceId = randomUUID()
        console.warn('[Instance ID] Failed to persist instance ID, using temporary fallback value:', error)
        return fallbackInstanceId
      })
      .finally(() => {
        pendingInstanceIdPromise = null
      })
  }

  return pendingInstanceIdPromise
}
