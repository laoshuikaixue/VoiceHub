import { randomUUID } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { SYSTEM_SETTINGS_DEFAULTS } from './system-settings-defaults'

export interface InstanceIdInfo {
  instanceId: string
  persisted: boolean
}

let cachedInstanceIdInfo: InstanceIdInfo | null = null
let cachedInstanceIdExpiresAt = 0
let pendingInstanceIdPromise: Promise<string> | null = null
let pendingInstanceIdInfoPromise: Promise<InstanceIdInfo> | null = null

const TEMPORARY_INSTANCE_ID_CACHE_TTL_MS = 5 * 60 * 1000

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

const getCachedInstanceIdInfo = (): InstanceIdInfo | null => {
  if (!cachedInstanceIdInfo) {
    return null
  }

  if (cachedInstanceIdInfo.persisted || cachedInstanceIdExpiresAt > getServerTimestamp()) {
    return cachedInstanceIdInfo
  }

  return null
}

export const getInstanceIdInfo = async (): Promise<InstanceIdInfo> => {
  const cached = getCachedInstanceIdInfo()
  if (cached) {
    return cached
  }

  if (!pendingInstanceIdInfoPromise) {
    pendingInstanceIdInfoPromise = loadOrCreateInstanceId()
      .then((instanceId) => {
        const info = { instanceId, persisted: true }
        cachedInstanceIdInfo = info
        cachedInstanceIdExpiresAt = Number.POSITIVE_INFINITY
        return info
      })
      .catch((error) => {
        const fallbackInstanceId = cachedInstanceIdInfo?.persisted === false
          ? cachedInstanceIdInfo.instanceId
          : randomUUID()

        const info = { instanceId: fallbackInstanceId, persisted: false }
        cachedInstanceIdInfo = info
        cachedInstanceIdExpiresAt = getServerTimestamp() + TEMPORARY_INSTANCE_ID_CACHE_TTL_MS
        console.warn('[Instance ID] Failed to persist instance ID, using temporary fallback value:', error)
        return info
      })
      .finally(() => {
        pendingInstanceIdInfoPromise = null
      })
  }

  return pendingInstanceIdInfoPromise
}

export const getInstanceId = async (): Promise<string> => {
  if (!pendingInstanceIdPromise) {
    pendingInstanceIdPromise = getInstanceIdInfo()
      .then(({ instanceId }) => instanceId)
      .finally(() => {
        pendingInstanceIdPromise = null
      })
  }

  return pendingInstanceIdPromise
}
