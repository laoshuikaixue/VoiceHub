import { lt } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { adminAuditLogs, apiLogs } from '~/drizzle/schema'
import { getSystemSettingsCached } from './system-settings-helper.ts'
import { getServerDate } from './serverTime.ts'
import { resolveLogSettings, type LogSettings } from './log-settings.ts'

/**
 * 日志保留策略：按配置的保留天数清理数据库中的 API 访问日志与管理员审计日志。
 * 保留天数 0 表示永久保留；配置缺失或非法时回退默认值。
 */

export async function getLogSettings(): Promise<LogSettings> {
  return resolveLogSettings(await getSystemSettingsCached())
}

function retentionCutoff(days: number): Date | null {
  if (days <= 0) return null
  return new Date(getServerDate().getTime() - days * 24 * 60 * 60 * 1000)
}

function affectedRows(result: unknown): number {
  // postgres.js 用 count 表示受影响行数
  return Number((result as { count?: number })?.count ?? 0)
}

export async function cleanupApiLogs(days: number): Promise<number> {
  const cutoff = retentionCutoff(days)
  if (!cutoff) return 0
  const result = await db.delete(apiLogs).where(lt(apiLogs.createdAt, cutoff))
  return affectedRows(result)
}

export async function cleanupAuditLogs(days: number): Promise<number> {
  const cutoff = retentionCutoff(days)
  if (!cutoff) return 0
  const result = await db.delete(adminAuditLogs).where(lt(adminAuditLogs.createdAt, cutoff))
  return affectedRows(result)
}

export interface LogCleanupResult extends LogSettings {
  apiDeleted: number
  auditDeleted: number
}

/** 按当前配置清理两类数据库日志。 */
export async function runLogRetentionCleanup(
  settings?: LogSettings
): Promise<LogCleanupResult> {
  const resolved = settings ?? (await getLogSettings())
  const apiDeleted = await cleanupApiLogs(resolved.apiLogRetentionDays)
  const auditDeleted = await cleanupAuditLogs(resolved.auditLogRetentionDays)
  return { ...resolved, apiDeleted, auditDeleted }
}
