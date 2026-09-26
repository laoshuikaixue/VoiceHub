import { isAstrbotPlatformEnabled, parseAstrbotPlatform } from './astrbot-platforms.ts'
import type { AstrbotPlatform } from './astrbot-platforms.ts'

/**
 * 群广播目标与群事件配置的规范化工具。
 *
 * 关键背景：AstrBot 的 UMO 前缀取自**平台实例 ID**（platform_meta.id），管理员
 * 可以把它改成任意合法字符串，因此无法从会话串推断该群属于哪个平台。四平台
 * 共用同一个插件实例时，若靠推断决定投递，就会出现「钉钉的群被当成 QQ 群投递」
 * 这类越权。所以每条群目标都必须由管理员在后台显式标注平台归属。
 */

/** 群事件类型。默认只开高频需求，其余事件按需在后台开启。 */
export const ASTRBOT_GROUP_EVENT_KEYS = [
  'songRequest',
  'registrationPending',
  'backupFailed',
  'systemError',
  'systemNotice',
  'songPlayed',
  'replayRequest'
] as const
export type AstrbotGroupEventKey = typeof ASTRBOT_GROUP_EVENT_KEYS[number]

export type AstrbotGroupTarget = { umo: string; platform: AstrbotPlatform; label: string }
export type AstrbotGroupEventSettings = Record<AstrbotGroupEventKey, boolean>
export type AstrbotGroupThrottle = { mergeWindowSeconds: number; minIntervalSeconds: number }

export const DEFAULT_ASTRBOT_GROUP_EVENTS: AstrbotGroupEventSettings = {
  songRequest: true,
  registrationPending: true,
  backupFailed: true,
  systemError: true,
  // 管理员手动发送的系统通知：默认转发到白名单全部群，可在发送时取消勾选。
  systemNotice: true,
  songPlayed: false,
  replayRequest: false
}

/** 防刷屏默认值：合并窗口 5 分钟，同群同事件最短间隔 60 秒。 */
export const DEFAULT_ASTRBOT_GROUP_THROTTLE: AstrbotGroupThrottle = {
  mergeWindowSeconds: 300,
  minIntervalSeconds: 60
}

export const ASTRBOT_GROUP_TARGETS_MAX = 50
const ASTRBOT_GROUP_LABEL_MAX = 64
const ASTRBOT_GROUP_THROTTLE_MAX_SECONDS = 3600

/** 群会话 UMO 形态：三段式且中段为 GroupMessage。 */
export function isAstrbotGroupUmoShape(umo: unknown): umo is string {
  if (typeof umo !== 'string' || umo.length > 512) return false
  // 任何空白字符都不允许：会话串会直接拼进推送目标，含空白的取值一定是脏数据，
  // 且插件侧的解析同样拒绝空白，两侧判定必须一致。
  if (/\s/u.test(umo)) return false
  const parts = umo.split(':')
  return parts.length === 3 && parts[1] === 'GroupMessage' && !!parts[0] && !!parts[2]
}

/**
 * 规范化后台提交的群目标列表。
 *
 * 逐项校验并丢弃非法项（而不是整批拒绝）：后台是管理员手动录入的，
 * 混入一条格式错误的会话不应该让整份配置无法保存。返回 null 表示
 * 入参根本不是数组，调用方应拒绝该请求。
 */
export function normalizeAstrbotGroupTargets(raw: unknown): AstrbotGroupTarget[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const result: AstrbotGroupTarget[] = []
  for (const item of raw.slice(0, ASTRBOT_GROUP_TARGETS_MAX)) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const umo = typeof record.umo === 'string' ? record.umo.trim() : ''
    const platform = parseAstrbotPlatform(record.platform)
    if (!platform || !isAstrbotGroupUmoShape(umo) || seen.has(umo)) continue
    seen.add(umo)
    result.push({
      umo,
      platform,
      label: typeof record.label === 'string' ? record.label.trim().slice(0, ASTRBOT_GROUP_LABEL_MAX) : ''
    })
  }
  return result
}

/** 规范化事件开关：未知键丢弃，缺失键回退默认值，非布尔值不生效。 */
export function normalizeAstrbotGroupEvents(raw: unknown): AstrbotGroupEventSettings {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return Object.fromEntries(ASTRBOT_GROUP_EVENT_KEYS.map((key) => [
    key, typeof source[key] === 'boolean' ? source[key] : DEFAULT_ASTRBOT_GROUP_EVENTS[key]
  ])) as AstrbotGroupEventSettings
}

function clampSeconds(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(Math.trunc(numeric), 0), ASTRBOT_GROUP_THROTTLE_MAX_SECONDS)
}

/** 规范化防刷屏参数：越界或非法值回退默认，避免 0 或负数导致每条事件都单独发。 */
export function normalizeAstrbotGroupThrottle(raw: unknown): AstrbotGroupThrottle {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return {
    mergeWindowSeconds: clampSeconds(source.mergeWindowSeconds, DEFAULT_ASTRBOT_GROUP_THROTTLE.mergeWindowSeconds),
    minIntervalSeconds: clampSeconds(source.minIntervalSeconds, DEFAULT_ASTRBOT_GROUP_THROTTLE.minIntervalSeconds)
  }
}

/** 事件开关是否打开。 */
export function isAstrbotGroupEventEnabled(raw: unknown, eventKey: AstrbotGroupEventKey): boolean {
  return normalizeAstrbotGroupEvents(raw)[eventKey] === true
}

/**
 * 选出本次事件要投递的群会话。
 *
 * 三重过滤，任一不满足即不投递：总开关、事件开关、目标自身平台开关。
 */
export function selectAstrbotGroupTargets(
  raw: unknown,
  settings: { astrbotEnabled?: boolean | null; astrbotBroadcastEnabled?: boolean | null; astrbotPlatforms?: unknown },
  eventKey: AstrbotGroupEventKey
): string[] {
  if (!settings.astrbotEnabled || !settings.astrbotBroadcastEnabled) return []
  if (!isAstrbotGroupEventEnabled((settings as { astrbotGroupEvents?: unknown }).astrbotGroupEvents, eventKey)) {
    return []
  }
  const targets = normalizeAstrbotGroupTargets(raw) ?? []
  return [...new Set(targets
    .filter((target) => isAstrbotPlatformEnabled(settings.astrbotPlatforms, target.platform))
    .map((target) => target.umo))]
}

/** 群会话是否在管理员白名单内且平台已启用（供插件回查与投递前复核）。 */
export function isAstrbotGroupTargetAllowed(raw: unknown, platforms: unknown, umo: unknown): boolean {
  if (!isAstrbotGroupUmoShape(umo)) return false
  const targets = normalizeAstrbotGroupTargets(raw) ?? []
  return targets.some((target) => target.umo === umo && isAstrbotPlatformEnabled(platforms, target.platform))
}

// ---------------------------------------------------------------------------
// 防刷屏的纯逻辑：合并窗口 + 同群同事件冷却
//
// 语义是「带最大延迟的防抖」：
//   - 一条群消息最早在最后一次事件之后 minIntervalSeconds 秒发出，避免连发；
//   - 但最多只等到首条事件之后 mergeWindowSeconds 秒，避免高峰期一直推迟不发。
// 抽成纯函数是为了让这段规则可以被直接测试，不必依赖数据库。
// ---------------------------------------------------------------------------

/** 合并与冷却的最大正文长度；超出即截断，避免无限追加把请求体撑爆。 */
export const ASTRBOT_GROUP_MESSAGE_MAX_CHARS = 3000
export const ASTRBOT_GROUP_MESSAGE_TRUNCATED = '\n…（内容过多，已省略部分）'

/** 把新事件正文追加到已合并正文，超长时截断。 */
export function appendAstrbotGroupContent(existing: string, incoming: string): string {
  const separator = existing ? '\n' : ''
  const merged = `${existing}${separator}${incoming}`
  if (merged.length <= ASTRBOT_GROUP_MESSAGE_MAX_CHARS) return merged
  const head = merged.slice(0, ASTRBOT_GROUP_MESSAGE_MAX_CHARS - ASTRBOT_GROUP_MESSAGE_TRUNCATED.length)
  return `${head}${ASTRBOT_GROUP_MESSAGE_TRUNCATED}`
}

/**
 * 计算一条群消息的投递闸门时刻。
 *
 * Args:
 *     createdAt: 该条目首次入队时间（合并窗口从此起算）。
 *     lastEventAt: 最近一次合并进来的事件时间。
 *     throttle: 防刷屏参数。
 */
export function computeAstrbotGroupNotifyAfter(
  createdAt: Date, lastEventAt: Date, throttle: AstrbotGroupThrottle
): Date {
  const cooldown = lastEventAt.getTime() + throttle.minIntervalSeconds * 1000
  const maxDelay = createdAt.getTime() + throttle.mergeWindowSeconds * 1000
  return new Date(Math.min(cooldown, maxDelay))
}

/** 待投递条目是否可以承接新事件：仍在合并窗口内且尚未被领取投递。 */
export function canMergeAstrbotGroupEvent(
  row: { createdAt: Date; attempts?: number; leasedUntil?: Date | null; deliveredAt?: Date | null; failedAt?: Date | null },
  now: Date,
  throttle: AstrbotGroupThrottle
): boolean {
  if (row.deliveredAt || row.failedAt) return false
  if ((row.attempts ?? 0) > 0) return false
  if (row.leasedUntil && row.leasedUntil.getTime() > now.getTime()) return false
  return now.getTime() - row.createdAt.getTime() < throttle.mergeWindowSeconds * 1000
}
