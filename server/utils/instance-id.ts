import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
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
    // Enforce singleton row (id=1) to avoid concurrent cold-start inserts creating duplicates.
    await db
      .insert(systemSettings)
      .values({ id: 1, ...SYSTEM_SETTINGS_DEFAULTS, instanceId })
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: { instanceId, updatedAt: new Date() }
      })
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
        // Use fallback UUID but don't cache as final - allow retry on next call
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
