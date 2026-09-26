import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '~/drizzle/db'
import { astrbotOutbox } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import {
  ASTRBOT_GROUP_EVENT_KEYS,
  appendAstrbotGroupContent,
  canMergeAstrbotGroupEvent,
  canMergeAstrbotGroupTargets,
  computeAstrbotGroupNotifyAfter,
  isAstrbotGroupTargetAllowed,
  normalizeAstrbotGroupTargets,
  normalizeAstrbotGroupThrottle,
  selectAstrbotGroupTargets
} from '~~/server/utils/astrbot-group'
import type { AstrbotGroupEventKey, AstrbotGroupThrottle } from '~~/server/utils/astrbot-group'
import { fitsAstrbotPayload } from '~~/server/utils/astrbot-payload'
import { ASTRBOT_OUTBOX_MAX_ATTEMPTS, isAstrbotPullMode } from '~~/server/utils/astrbot-pull'
import { postAstrbotNotification } from '~~/server/services/astrbotNotificationService'

/**
 * 群聊事件推送。
 *
 * 目标白名单的唯一来源是 VoiceHub 后台的 `astrbotGroupTargets`：每条目标都由
 * 管理员显式标注平台归属（UMO 前缀是平台实例 ID，无法反推适配器），投递前按
 * 事件开关、平台开关、总开关三重过滤。
 *
 * 防刷屏语义是「带最大延迟的防抖」，见 astrbot-group.ts 中的纯函数：同群同类型
 * 事件在冷却期内合并为一条，因此高峰只会让群收到一条合并消息而不是几十条。
 */

/** 单次最多处理的待合并条目数，避免一次事件拉取过多历史行。 */
const ASTRBOT_GROUP_MERGE_SCAN = 50
/** 单次冲刷最多投递的条目数。 */
const ASTRBOT_GROUP_FLUSH_LIMIT = 10
const ASTRBOT_GROUP_LEASE_MS = 120_000

type GroupRuntimeSettings = {
  enabled: boolean
  platforms: unknown
  eventSettings: unknown
  targets: unknown
  throttle: AstrbotGroupThrottle
}

/** 读取群推送所需的全部设置（单次查库）。 */
async function readGroupSettings(): Promise<GroupRuntimeSettings> {
  const settings = await getSystemSettingsCached()
  return {
    enabled: !!settings?.astrbotEnabled && !!settings?.astrbotBroadcastEnabled,
    platforms: settings?.astrbotPlatforms ?? {},
    eventSettings: settings?.astrbotGroupEvents ?? {},
    targets: settings?.astrbotGroupTargets ?? [],
    throttle: normalizeAstrbotGroupThrottle(settings?.astrbotGroupThrottle)
  }
}

/**
 * 入队一条群事件。
 *
 * Returns:
 *    受影响的目标数（新起条目 + 合并进既有条目的目标）。未启用、事件开关关闭
 *    或未命中白名单时返回 0。
 */
export async function enqueueAstrbotGroupEvent(
  eventKey: AstrbotGroupEventKey, title: string, content: string
): Promise<number> {
  if (!(ASTRBOT_GROUP_EVENT_KEYS as readonly string[]).includes(eventKey)) return 0
  if (!content.trim()) return 0
  try {
    const settings = await readGroupSettings()
    const umos = selectAstrbotGroupTargets(settings.targets, {
      astrbotEnabled: settings.enabled,
      astrbotBroadcastEnabled: settings.enabled,
      astrbotPlatforms: settings.platforms,
      astrbotGroupEvents: settings.eventSettings
    }, eventKey)
    if (!umos.length) return 0
    return await queueToGroups(umos, title, content, eventKey, settings.throttle)
  } catch (error) {
    console.error(`AstrBot 群事件入队失败（${eventKey}）:`, error)
    return 0
  }
}

/** 把一条事件投递给若干群目标，仍在合并窗口内的目标走合并而非新建。 */
async function queueToGroups(
  umos: string[], title: string, content: string, eventKey: AstrbotGroupEventKey, throttle: AstrbotGroupThrottle
): Promise<number> {
  const now = getServerDate()
  const pending = new Set<string>()
  let affected = 0

  return db.transaction(async (tx) => {
  // 同类型事件串行合并，避免没有候选行时两个请求同时插入，或互相覆盖正文。
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventKey}))`)
  const candidates = await tx.select().from(astrbotOutbox)
    .where(and(
      eq(astrbotOutbox.broadcast, true),
      eq(astrbotOutbox.eventKey, eventKey),
      isNull(astrbotOutbox.deliveredAt),
      isNull(astrbotOutbox.failedAt),
      eq(astrbotOutbox.attempts, 0)
    ))
    .orderBy(asc(astrbotOutbox.id))
    .limit(ASTRBOT_GROUP_MERGE_SCAN)
    .for('update', { skipLocked: true })

  for (const row of candidates) {
    if (!canMergeAstrbotGroupEvent(row, now, throttle)) continue
    const rowUmox = Array.isArray(row.umos) ? row.umos : []
    if (!canMergeAstrbotGroupTargets(rowUmox, umos, pending)) continue
    await tx.update(astrbotOutbox).set({
      message: appendAstrbotGroupContent(row.message, content),
      notifyAfter: computeAstrbotGroupNotifyAfter(row.createdAt, now, throttle)
    }).where(eq(astrbotOutbox.id, row.id))
    rowUmox.forEach((umo) => pending.add(umo))
    affected += rowUmox.length
  }

  const fresh = umos.filter((umo) => !pending.has(umo))
  if (!fresh.length) return affected
  if (!fitsAstrbotPayload(fresh, title, content, true)) {
    console.error(`AstrBot 群事件未入队：正文超过单条投递大小限制（${eventKey}）`)
    return affected
  }
  await tx.insert(astrbotOutbox).values({
    title,
    message: content,
    umos: fresh,
    broadcast: true,
    eventKey,
    // 群目标不绑定用户，没有归属快照；投递前按白名单复核，故此处显式留空。
    targetOwners: null,
    notifyAfter: computeAstrbotGroupNotifyAfter(now, now, throttle)
  })
  return affected + fresh.length
  })
}

/**
 * 领取可以立刻投递的群条目（push 模式）。
 *
 * 只取冷却闸门已过的条目；领取加租约，投递失败的条目由下一次冲刷重试。
 */
export async function claimAstrbotGroupOutbox(limit = ASTRBOT_GROUP_FLUSH_LIMIT) {
  const now = getServerDate()
  return db.transaction(async (tx) => {
  await tx.update(astrbotOutbox).set({ failedAt: now, leasedUntil: null, claimToken: null,
    lastError: '群投递超过重试上限' }).where(and(
    eq(astrbotOutbox.broadcast, true), isNull(astrbotOutbox.deliveredAt), isNull(astrbotOutbox.failedAt),
    sql`${astrbotOutbox.attempts} >= ${ASTRBOT_OUTBOX_MAX_ATTEMPTS}`,
    or(isNull(astrbotOutbox.leasedUntil), lte(astrbotOutbox.leasedUntil, now))
  ))
  const rows = await tx.select({ id: astrbotOutbox.id }).from(astrbotOutbox)
    .where(and(
      eq(astrbotOutbox.broadcast, true),
      isNull(astrbotOutbox.deliveredAt),
      isNull(astrbotOutbox.failedAt),
      sql`${astrbotOutbox.attempts} < ${ASTRBOT_OUTBOX_MAX_ATTEMPTS}`,
      or(isNull(astrbotOutbox.leasedUntil), lte(astrbotOutbox.leasedUntil, now)),
      or(isNull(astrbotOutbox.notifyAfter), lte(astrbotOutbox.notifyAfter, now))
    ))
    .orderBy(asc(astrbotOutbox.id))
    .limit(Math.min(Math.max(limit, 1), ASTRBOT_GROUP_MERGE_SCAN))
    .for('update', { skipLocked: true })
  if (!rows.length) return []
  const claimed = [] as (typeof astrbotOutbox.$inferSelect)[]
  for (const { id } of rows) {
    const [row] = await tx.update(astrbotOutbox)
      .set({
        leasedUntil: new Date(now.getTime() + ASTRBOT_GROUP_LEASE_MS),
        claimToken: randomBytes(32).toString('hex'),
        attempts: sql`${astrbotOutbox.attempts} + 1`
      })
      .where(eq(astrbotOutbox.id, id))
      .returning()
    if (row) claimed.push(row)
  }
  return claimed
  })
}

/**
 * 冲刷一次待投递群事件（push 模式调用）。
 *
 * 投递前按当前白名单复核目标：管理员把某个群移出白名单后，队列里的旧条目
 * 不得继续投递，直接标记失败。
 */
export async function flushAstrbotGroupOutbox(): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  const settings = await readGroupSettings()
  if (!settings.enabled) return { sent, failed }
  const runtime = await getSystemSettingsCached()
  if (isAstrbotPullMode(runtime?.astrbotPushMode)) return { sent, failed }
  const targets = normalizeAstrbotGroupTargets(settings.targets) ?? []
  for (const row of await claimAstrbotGroupOutbox()) {
    const owned = and(eq(astrbotOutbox.id, row.id), eq(astrbotOutbox.claimToken, row.claimToken!),
      gt(astrbotOutbox.leasedUntil, getServerDate()), isNull(astrbotOutbox.deliveredAt), isNull(astrbotOutbox.failedAt))
    const originalUmos = Array.isArray(row.umos) ? row.umos : []
    const umos = originalUmos
      .filter((umo) => isAstrbotGroupTargetAllowed(targets, settings.platforms, umo))
    if (!umos.length) {
      const updated = await db.update(astrbotOutbox)
        .set({ failedAt: getServerDate(), leasedUntil: null, claimToken: null, lastError: '群目标已移出白名单' })
        .where(owned)
        .returning({ id: astrbotOutbox.id })
      if (updated.length) failed++
      continue
    }
    try {
      const result = await postAstrbotNotification(umos, row.title ?? '', row.message, true)
      if (result.sent >= umos.length && result.failed === 0) {
        const updated = await db.update(astrbotOutbox)
          .set({ deliveredAt: getServerDate(), umos, leasedUntil: null, claimToken: null, lastError: null })
          .where(owned)
          .returning({ id: astrbotOutbox.id })
        if (updated.length) sent += result.sent
      } else {
        const retryUmos = result.failedUmos
        const knownFailures = retryUmos?.length && retryUmos.length === result.failed &&
          retryUmos.every((umo) => umos.includes(umo)) && new Set(retryUmos).size === retryUmos.length
        const updated = await db.update(astrbotOutbox)
          .set({ leasedUntil: null, claimToken: null,
            umos: knownFailures ? retryUmos : umos, lastError: '群投递未成功',
            failedAt: row.attempts >= ASTRBOT_OUTBOX_MAX_ATTEMPTS ? getServerDate() : null })
          .where(owned)
          .returning({ id: astrbotOutbox.id })
        if (updated.length) failed++
      }
    } catch (error) {
      const updated = await db.update(astrbotOutbox)
        .set({ umos, leasedUntil: null, claimToken: null, lastError: String(error).slice(0, 500),
          failedAt: row.attempts >= ASTRBOT_OUTBOX_MAX_ATTEMPTS ? getServerDate() : null })
        .where(owned)
        .returning({ id: astrbotOutbox.id })
      if (updated.length) failed++
      console.error('AstrBot 群事件投递失败:', error)
    }
  }
  return { sent, failed }
}
