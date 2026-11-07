import { lt } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { adminAuditLogs, apiLogs } from '~/drizzle/schema'
import { getSystemSettingsCached } from './system-settings-helper.ts'
import { getServerTimestamp, getServerDate } from './serverTime.ts'
import { resolveLogSettings, type LogSettings } from './log-settings.ts'

/**
 * 日志保留策略：按配置的保留天数清理数据库中的 API 访问日志与管理员审计日志。
 * 保留天数 0 表示永久保留；配置缺失或非法时回退默认值。
 */

/** 惰性清理的最小间隔：避免每次读写日志都触发删除。 */
const LAZY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000

let lastLazyCleanupAt = 0
let pendingLazyCleanup: Promise<void> | null = null

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

/**
 * 惰性清理：在日志相关请求中按小时节流触发一次。
 *
 * serverless 实例没有常驻生命周期，定时器不可依赖，因此清理挂在真实请求上；
 * 并发调用共用同一个 promise，失败不更新节流时间，下次请求会重试。
 */
export async function runLazyLogRetentionCleanup(): Promise<void> {
  const now = getServerTimestamp()
  if (now - lastLazyCleanupAt < LAZY_CLEANUP_INTERVAL_MS) return
  if (pendingLazyCleanup) return pendingLazyCleanup

  pendingLazyCleanup = (async () => {
    try {
      const result = await runLogRetentionCleanup()
      lastLazyCleanupAt = getServerTimestamp()
      if (result.apiDeleted || result.auditDeleted) {
        console.log(
          `[LogRetention] 清理过期日志: API ${result.apiDeleted} 条，审计 ${result.auditDeleted} 条`
        )
      }
    } catch (error) {
      console.error('[LogRetention] 清理过期日志失败:', error)
    } finally {
      pendingLazyCleanup = null
    }
  })()

  return pendingLazyCleanup
}
