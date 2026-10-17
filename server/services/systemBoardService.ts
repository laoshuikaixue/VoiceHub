import { and, desc, eq, gte, isNotNull, lt, or, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import {
  apiLogs,
  passwordAuditLogs,
  playTimes,
  requestTimes,
  semesters,
  systemSettings
} from '~/drizzle/schema'
import { formatDateTime } from '~/utils/timeUtils'
import { sanitizeAstrbotErrorDetail } from '~~/server/utils/astrbot-error-telemetry'
import { databaseManager } from '~~/server/utils/database-manager'
import { getInstanceId } from '~~/server/utils/instance-id'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { isTelemetryEnabled } from '~~/server/utils/telemetry'
import {
  clearRuntimeEvents,
  listRuntimeEvents,
  type SystemEventLevel
} from '~~/server/utils/system-event-buffer'
import {
  MUSIC_SOURCE_PLATFORMS,
  SYSTEM_BOARD_CONSTANTS,
  SYSTEM_BOARD_EVENT_LEVELS,
  SYSTEM_BOARD_EVENT_SOURCES,
  type SystemBoardEventLevel,
  type SystemBoardEventSource
} from '~~/server/config/constants'

export interface BoardEvent {
  id: string
  level: SystemEventLevel
  source: SystemBoardEventSource
  sourceLabel: string
  message: string
  detail?: string
  timestamp: number
  at: string
}

export interface BoardEventsQuery {
  limit?: number
  level?: SystemEventLevel
  source?: SystemBoardEventSource
}

/** 解析查询参数，非法值回退默认，避免前端拼接出错导致接口失败 */
export function resolveBoardEventsQuery(query: Record<string, unknown>): BoardEventsQuery {
  const limit = Number(query.limit)
  const level = SYSTEM_BOARD_EVENT_LEVELS.includes(query.level as SystemBoardEventLevel)
    ? (query.level as SystemBoardEventLevel)
    : undefined
  const source = SYSTEM_BOARD_EVENT_SOURCES.includes(query.source as SystemBoardEventSource)
    ? (query.source as SystemBoardEventSource)
    : undefined

  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined,
    level,
    source
  }
}

/** 看板快照：进程状态 + 数据库状态 + 表规模 + 生效配置 + 最近事件 */
export async function getSystemBoardSnapshot() {
  const nowMs = getServerTimestamp()
  const uptimeSeconds = Math.floor(process.uptime())

  const [database, tables, settings, instanceId, telemetryEnabled] = await Promise.all([
    collectDatabaseStatus(),
    collectTableStats(),
    collectEffectiveSettings(),
    getInstanceId().catch(() => ''),
    isTelemetryEnabled().catch(() => false)
  ])

  const memory = process.memoryUsage()

  return {
    system: {
      serverTimeAt: formatDateTime(new Date(nowMs)),
      uptimeSeconds,
      startedAt: formatDateTime(new Date(nowMs - uptimeSeconds * 1000)),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      env: process.env.NODE_ENV || 'production',
      instanceId,
      telemetryEnabled,
      memory: {
        rss: toMb(memory.rss),
        heapUsed: toMb(memory.heapUsed),
        heapTotal: toMb(memory.heapTotal),
        external: toMb(memory.external)
      }
    },
    database,
    tables,
    settings
  }
}

async function collectDatabaseStatus() {
  const [health, pool] = await Promise.all([
    databaseManager.healthCheck(),
    databaseManager.getConnectionPoolStatus().catch(() => null)
  ])

  let databaseSize = ''
  try {
    const sizeResult = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size
    `)
    databaseSize = String((sizeResult as Array<{ size?: string }>)[0]?.size ?? '')
  } catch {
    // 权限不足或数据库不可用时留空，前端显示为未知
  }

  return {
    connected: health.status,
    latencyMs: health.latency,
    statusLabel: health.connectionStatus,
    // 驱动原始错误可能夹带主机端口/账号，脱敏后才给前端
    error: health.error ? sanitizeAstrbotErrorDetail(health.error) : null,
    databaseSize,
    pool: pool
      ? {
          maxConnections: Number(pool.maxConnections) || 0,
          activeConnections: Number(pool.activeConnections) || 0,
          totalConnections: Number(pool.totalConnections) || 0,
          utilization: Number(pool.utilization) || 0
        }
      : null
  }
}

/** 表规模走 pg_stat_user_tables 估算值，避免在大表上做 COUNT(*) */
async function collectTableStats() {
  try {
    const rows = await db.execute(sql`
      SELECT relname AS name, COALESCE(n_live_tup, 0)::bigint AS rows
      FROM pg_stat_user_tables
      WHERE relname NOT LIKE '\\_\\_drizzle%'
      ORDER BY n_live_tup DESC, relname ASC
    `)

    // bigint 列由 postgres-js 返回字符串，统一转数字
    const list = (rows as unknown as Array<{ name: string; rows: string | number }>).map((row) => ({
      name: row.name,
      rows: Number(row.rows) || 0
    }))

    return {
      list,
      totalTables: list.length,
      totalRows: list.reduce((sum, item) => sum + item.rows, 0)
    }
  } catch (error) {
    console.error('[SystemBoard] 读取表规模失败:', error)
    return { list: [], totalTables: 0, totalRows: 0 }
  }
}

/** 只输出排错需要的开关键值，密钥/令牌/连接串类字段一律不外泄 */
async function collectEffectiveSettings() {
  try {
    const [row] = await db
      .select({
        siteTitle: systemSettings.siteTitle,
        defaultTheme: systemSettings.defaultTheme,
        enabledPlatforms: systemSettings.enabledPlatforms,
        allowRegister: systemSettings.allowRegister,
        registerRequiresApproval: systemSettings.registerRequiresApproval,
        captchaEnabled: systemSettings.captchaEnabled,
        smtpEnabled: systemSettings.smtpEnabled,
        astrbotEnabled: systemSettings.astrbotEnabled,
        astrbotPushMode: systemSettings.astrbotPushMode,
        autoBackupEnabled: systemSettings.autoBackupEnabled,
        enableSubmissionLimit: systemSettings.enableSubmissionLimit,
        dailySubmissionLimit: systemSettings.dailySubmissionLimit,
        weeklySubmissionLimit: systemSettings.weeklySubmissionLimit,
        monthlySubmissionLimit: systemSettings.monthlySubmissionLimit,
        enableGlobalSubmissionLimit: systemSettings.enableGlobalSubmissionLimit,
        globalDailySubmissionLimit: systemSettings.globalDailySubmissionLimit,
        globalWeeklySubmissionLimit: systemSettings.globalWeeklySubmissionLimit,
        globalMonthlySubmissionLimit: systemSettings.globalMonthlySubmissionLimit,
        enableRequestTimeLimitation: systemSettings.enableRequestTimeLimitation,
        forceBlockAllRequests: systemSettings.forceBlockAllRequests,
        enableReplayRequests: systemSettings.enableReplayRequests,
        enableCollaborativeSubmission: systemSettings.enableCollaborativeSubmission,
        enableCardCodeRequests: systemSettings.enableCardCodeRequests,
        requireCardCodeForRequests: systemSettings.requireCardCodeForRequests,
        hideStudentInfo: systemSettings.hideStudentInfo
      })
      .from(systemSettings)
      .limit(1)

    if (!row) return null

    const [semester, playTimeRows, requestTimeRows] = await Promise.all([
      db
        .select({ name: semesters.name })
        .from(semesters)
        .where(eq(semesters.isActive, true))
        .limit(1),
      db
        .select({ id: playTimes.id, enabled: playTimes.enabled })
        .from(playTimes),
      db.select({ id: requestTimes.id, enabled: requestTimes.enabled }).from(requestTimes)
    ])

    return {
      ...row,
      enabledPlatforms: parsePlatformList(row.enabledPlatforms),
      currentSemester: semester[0]?.name ?? '',
      playTimeTotal: playTimeRows.length,
      playTimeEnabled: countEnabled(playTimeRows),
      requestTimeTotal: requestTimeRows.length,
      requestTimeEnabled: countEnabled(requestTimeRows)
    }
  } catch (error) {
    console.error('[SystemBoard] 读取生效配置失败:', error)
    return null
  }
}

function countEnabled(rows: Array<{ enabled: boolean }>): number {
  return rows.filter((row) => row.enabled).length
}

/** 配置字段可能是非法 JSON 或含未知平台，只保留白名单内的值 */
function parsePlatformList(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw ?? '[]'))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is string =>
        typeof item === 'string' && (MUSIC_SOURCE_PLATFORMS as readonly string[]).includes(item)
    )
  } catch {
    return []
  }
}

/**
 * 合并运行事件：进程内缓冲（异常/请求 5xx/健康检查）+ API 错误日志 + 口令审计。
 * 三者时间戳均为 UTC，统一转成毫秒后按新→旧排序，并给出北京时间展示字段。
 */
export async function getBoardEvents(
  options: BoardEventsQuery = {}
): Promise<{ list: BoardEvent[]; truncated: boolean }> {
  const limit = clampLimit(options.limit)
  const events: BoardEvent[] = []
  let runtimeHasMore = false

  if (!options.source || options.source === 'runtime') {
    const runtimeEvents = listRuntimeEvents({ limit, level: options.level })
    runtimeHasMore = runtimeEvents.hasMore
    for (const item of runtimeEvents.items) {
      events.push({
        id: `runtime-${item.id}`,
        level: item.level,
        source: 'runtime',
        sourceLabel: item.source,
        message: item.message,
        detail: item.detail,
        timestamp: item.timestamp,
        at: formatDateTime(new Date(item.timestamp))
      })
    }
  }

  try {
    if (options.level !== 'info' && (!options.source || options.source === 'apiError')) {
      const rows = await db
        .select({
          id: apiLogs.id,
          endpoint: apiLogs.endpoint,
          method: apiLogs.method,
          statusCode: apiLogs.statusCode,
          responseTimeMs: apiLogs.responseTimeMs,
          errorMessage: apiLogs.errorMessage,
          createdAt: apiLogs.createdAt
        })
        .from(apiLogs)
        .where(
          options.level === 'error'
            ? gte(apiLogs.statusCode, 500)
            : options.level === 'warn'
              ? and(lt(apiLogs.statusCode, 500), isNotNull(apiLogs.errorMessage))
              : or(gte(apiLogs.statusCode, 500), isNotNull(apiLogs.errorMessage))
        )
        .orderBy(desc(apiLogs.createdAt))
        .limit(limit)

      for (const row of rows) {
        events.push({
          id: `api-${row.id}`,
          level: row.statusCode >= 500 ? 'error' : 'warn',
          source: 'apiError',
          sourceLabel: row.method,
          message: `${row.endpoint} → ${row.statusCode} (${row.responseTimeMs}ms)`,
          // 上游/驱动报错可能夹带地址与凭据，与运行事件同一脱敏口径
          detail: row.errorMessage ? sanitizeAstrbotErrorDetail(row.errorMessage) : undefined,
          timestamp: row.createdAt.getTime(),
          at: formatDateTime(row.createdAt)
        })
      }
    }
  } catch (error) {
    console.error('[SystemBoard] 读取 API 错误日志失败:', error)
  }

  try {
    if (options.level !== 'error' && (!options.source || options.source === 'passwordAudit')) {
      const rows = await db
        .select({
          id: passwordAuditLogs.id,
          userId: passwordAuditLogs.userId,
          action: passwordAuditLogs.action,
          success: passwordAuditLogs.success,
          failureReason: passwordAuditLogs.failureReason,
          ipAddress: passwordAuditLogs.ipAddress,
          createdAt: passwordAuditLogs.createdAt
        })
        .from(passwordAuditLogs)
        .where(
          options.level === 'warn'
            ? eq(passwordAuditLogs.success, false)
            : options.level === 'info'
              ? eq(passwordAuditLogs.success, true)
              : undefined
        )
        .orderBy(desc(passwordAuditLogs.createdAt))
        .limit(limit)

      for (const row of rows) {
        events.push({
          id: `pwd-${row.id}`,
          level: row.success ? 'info' : 'warn',
          source: 'passwordAudit',
          sourceLabel: row.action,
          message: `passwordAudit.${row.action}`,
          detail: JSON.stringify({ userId: row.userId, failureReason: row.failureReason, ipAddress: row.ipAddress }),
          timestamp: row.createdAt.getTime(),
          at: formatDateTime(row.createdAt)
        })
      }
    }
  } catch (error) {
    console.error('[SystemBoard] 读取口令审计失败:', error)
  }

  events.sort((a, b) => b.timestamp - a.timestamp)

  // 各来源分支已按 level/source 过滤，这里只需排序截断；缓冲侧截断单独标记
  return { list: events.slice(0, limit), truncated: runtimeHasMore || events.length > limit }
}

export function clearBoardRuntimeEvents(): number {
  return clearRuntimeEvents()
}

function clampLimit(value?: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return SYSTEM_BOARD_CONSTANTS.DEFAULT_EVENT_LIMIT
  return Math.min(Math.floor(parsed), SYSTEM_BOARD_CONSTANTS.MAX_EVENT_LIMIT)
}

function toMb(bytes: number): number {
  return Math.round(bytes / 1024 / 1024)
}
