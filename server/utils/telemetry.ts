import { asc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { CacheService } from '../services/cacheService'
import { SYSTEM_SETTINGS_DEFAULTS } from './system-settings-defaults'

let telemetryEnabledCache: boolean | null = null
let telemetryEnabledCacheExpiresAt = 0
let pendingTelemetryEnabledPromise: Promise<boolean> | null = null

const TELEMETRY_CACHE_TTL_MS = 5 * 60 * 1000

const readTelemetryEnabled = async (): Promise<boolean> => {
  try {
    const cachedSettings = await CacheService.getInstance().getSystemSettings()
    if (cachedSettings && typeof cachedSettings.telemetryEnabled === 'boolean') {
      return cachedSettings.telemetryEnabled
    }
  } catch (error) {
    console.warn('[Telemetry] Failed to read telemetry setting from cache:', error)
  }

  const settingsResult = await db
    .select({ telemetryEnabled: systemSettings.telemetryEnabled })
    .from(systemSettings)
    .orderBy(asc(systemSettings.id))
    .limit(1)

  return settingsResult[0]?.telemetryEnabled ?? SYSTEM_SETTINGS_DEFAULTS.telemetryEnabled
}

export const setTelemetryEnabledCache = (enabled: boolean) => {
  telemetryEnabledCache = enabled
  telemetryEnabledCacheExpiresAt = getServerTimestamp() + TELEMETRY_CACHE_TTL_MS
}

export const isTelemetryEnabledCached = () => telemetryEnabledCache === true

export const isTelemetryEnabled = async (): Promise<boolean> => {
  if (telemetryEnabledCache !== null && telemetryEnabledCacheExpiresAt > getServerTimestamp()) {
    return telemetryEnabledCache
  }

  if (!pendingTelemetryEnabledPromise) {
    pendingTelemetryEnabledPromise = readTelemetryEnabled()
      .then((enabled) => {
        setTelemetryEnabledCache(enabled)
        return enabled
      })
      .catch((error) => {
        console.warn('[Telemetry] Failed to resolve telemetry setting, telemetry disabled:', error)
        setTelemetryEnabledCache(false)
        return false
      })
      .finally(() => {
        pendingTelemetryEnabledPromise = null
      })
  }

  return pendingTelemetryEnabledPromise
}
