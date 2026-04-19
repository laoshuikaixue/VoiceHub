import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'

let cachedInstanceId: string | null = null
let pendingInstanceIdPromise: Promise<string> | null = null

const loadOrCreateInstanceId = async (): Promise<string> => {
  const settingsResult = await db
    .select({ id: systemSettings.id, instanceId: systemSettings.instanceId })
    .from(systemSettings)
    .limit(1)

  const settings = settingsResult[0]

  if (settings?.instanceId) {
    return settings.instanceId
  }

  const instanceId = randomUUID()

  if (!settings) {
    await db.insert(systemSettings).values({ instanceId }).returning({ instanceId: systemSettings.instanceId })
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
        const fallbackInstanceId = cachedInstanceId || randomUUID()
        cachedInstanceId = fallbackInstanceId
        console.warn('[Instance ID] Failed to persist instance ID, using fallback value:', error)
        return fallbackInstanceId
      })
      .finally(() => {
        pendingInstanceIdPromise = null
      })
  }

  return pendingInstanceIdPromise
}
