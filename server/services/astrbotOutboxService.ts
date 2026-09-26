import { and, asc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '~/drizzle/db'
import { astrbotOutbox, astrbotBindings, notificationSettings } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import { selectAstrbotTargets } from '~~/server/utils/astrbot-platforms'
import type { AstrbotPlatform } from '~~/server/utils/astrbot-platforms'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { isAstrbotGroupTargetAllowed, normalizeAstrbotGroupTargets } from '~~/server/utils/astrbot-group'
import { ASTRBOT_MAX_TARGETS_PER_REQUEST, fitsAstrbotPayload } from '~~/server/utils/astrbot-payload'

/** 一次领取的最大条数与租约时长：插件崩溃后条目可被重新领取。 */
export const ASTRBOT_OUTBOX_MAX_CLAIM = 20
export const ASTRBOT_OUTBOX_LEASE_SECONDS = 120

/**
 * 通知入队，供无法访问插件的部署使用（插件主动轮询取件）。
 *
 * 目标在入队时即解析完成：不像 push 模式那样在请求内直连插件，因此 VH 只需
 * 写库。返回入队条数；调用方据此判断是否有内容待投递。
 */
export async function enqueueAstrbotNotifications(
  userIds: number[], title: string, content: string, platform?: AstrbotPlatform
): Promise<number> {
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) return 0

  const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))]
  const rows = uniqueIds.length
    ? await db.select({ umo: astrbotBindings.umo, userId: astrbotBindings.userId, boundAt: astrbotBindings.boundAt,
      adapter: astrbotBindings.adapter, platform: astrbotBindings.platform, enabled: notificationSettings.enabled })
      .from(astrbotBindings)
      .leftJoin(notificationSettings, eq(notificationSettings.userId, astrbotBindings.userId))
      .where(inArray(astrbotBindings.userId, uniqueIds))
    : []
  const umos = selectAstrbotTargets(platform ? rows.filter((row) => row.platform === platform) : rows, settings.astrbotPlatforms)
  const owners = new Map(rows.map((row) => [row.umo, { userId: row.userId, boundAt: row.boundAt?.toISOString() ?? '' }]))
  // 群广播无法按平台过滤，四平台共用插件时禁止越过各平台开关：只投递已绑定的私聊会话。
  if (!umos.length) return 0
  // 插件按单条请求体上限投递，超限的正文无法投递，不入队以免插件永远失败重试。
  if (!fitsAstrbotPayload([], title, content, false)) {
    console.error('AstrBot 通知未入队：正文超过单条投递大小限制')
    return 0
  }

  const rowsToInsert: { title: string; message: string; umos: string[]; broadcast: boolean;
    targetOwners: Record<string, { userId: number; boundAt: string }> }[] = []
  for (let index = 0; index < umos.length; index += ASTRBOT_MAX_TARGETS_PER_REQUEST) {
    const batch = umos.slice(index, index + ASTRBOT_MAX_TARGETS_PER_REQUEST)
    rowsToInsert.push({
      title, message: content, broadcast: false,
      umos: batch, targetOwners: Object.fromEntries(batch.map((umo) => [umo, owners.get(umo)!]))
    })
  }
  if (!rowsToInsert.length) return 0
  await db.insert(astrbotOutbox).values(rowsToInsert)
  return rowsToInsert.length
}

/**
 * 领取一批待投递通知（私聊）。
 *
 * 租约（leasedUntil）避免同一批被并发领取两次；过期租约可被重新领取，
 * 使插件崩溃后不丢通知。领取即增加 attempts 计数。
 *
 * 群广播条目同样经此队列流转，但目标校验方式不同（按管理员白名单而非绑定表），
 * 因此这里一并处理：私聊行校验绑定归属，群行校验白名单与冷却闸门。
 */
export async function claimAstrbotOutbox(limit = ASTRBOT_OUTBOX_MAX_CLAIM) {
  const now = getServerDate()
  const until = new Date(now.getTime() + ASTRBOT_OUTBOX_LEASE_SECONDS * 1000)

  return db.transaction(async (tx) => {
    const claimable = await tx.select({ id: astrbotOutbox.id }).from(astrbotOutbox)
      .where(and(
        isNull(astrbotOutbox.deliveredAt),
        isNull(astrbotOutbox.failedAt),
        or(isNull(astrbotOutbox.leasedUntil), lt(astrbotOutbox.leasedUntil, now)),
        // 冷却未过的群条目留在队列里等合并，不得提前投递。
        or(isNull(astrbotOutbox.notifyAfter), lt(astrbotOutbox.notifyAfter, now))
      ))
      .orderBy(asc(astrbotOutbox.id))
      .limit(Math.min(Math.max(limit, 1), ASTRBOT_OUTBOX_MAX_CLAIM))
      .for('update', { skipLocked: true })
    if (!claimable.length) return []

    const ids = claimable.map((row) => row.id)
    const claimed = [] as (typeof astrbotOutbox.$inferSelect)[]
    for (const id of ids) {
      const [row] = await tx.update(astrbotOutbox)
        .set({ leasedUntil: until, claimToken: randomBytes(32).toString('hex'), attempts: sql`${astrbotOutbox.attempts} + 1` })
        .where(eq(astrbotOutbox.id, id))
        .returning()
      if (row) claimed.push(row)
    }
    const settings = await getSystemSettingsCached()
    if (!settings?.astrbotEnabled) return []

    // 群条目：按后台白名单（含平台开关）复核目标，与私聊绑定校验互不干扰。
    const groupRows = claimed.filter((row) => row.broadcast)
    const privateRows = claimed.filter((row) => !row.broadcast)
    const groups = normalizeAstrbotGroupTargets(settings.astrbotGroupTargets) ?? []
    const allowedGroups = new Set(groupRows.flatMap((row) => (Array.isArray(row.umos) ? row.umos : []))
      .filter((umo) => isAstrbotGroupTargetAllowed(groups, settings.astrbotPlatforms, umo)))

    const targets = [...new Set(privateRows.flatMap((row) => Array.isArray(row.umos) ? row.umos : []))]
    const bindings = targets.length ? await tx.select().from(astrbotBindings).where(inArray(astrbotBindings.umo, targets)) : []
    const valid = new Set(selectAstrbotTargets(bindings, settings.astrbotPlatforms))
    const current = new Map(bindings.map((binding) => [binding.umo, binding]))
    // 缺失快照的历史队列及解绑重绑后的队列均不可交付，避免 UMO 易主泄露。
    const filtered = [
      ...privateRows.map((row) => ({ ...row, umos: (Array.isArray(row.umos) ? row.umos : []).filter((umo) => {
        const original = row.targetOwners?.[umo]
        const binding = current.get(umo)
        return valid.has(umo) && !!original && !!original.boundAt && !!binding?.boundAt &&
          original.userId === binding.userId && original.boundAt === binding.boundAt.toISOString()
      }) })),
      ...groupRows.map((row) => ({ ...row, umos: (Array.isArray(row.umos) ? row.umos : [])
        .filter((umo) => allowedGroups.has(umo)) }))
    ]
    // 目标全部失效（私聊解绑 / 群移出白名单）的条目直接判失败，避免永久重试。
    const stale = filtered.filter((row) => !row.umos.length).map((row) => row.id)
    if (stale.length) await tx.update(astrbotOutbox).set({
      failedAt: now, leasedUntil: null, claimToken: null,
      lastError: '目标已解绑、移出白名单或平台已禁用'
    }).where(inArray(astrbotOutbox.id, stale))
    return filtered.filter((row) => row.umos.length > 0)
  })
}

/** 回执：标记投递成功。 */
export async function completeAstrbotOutbox(id: number, claimToken: string) {
  const now = getServerDate()
  const updated = await db.update(astrbotOutbox)
    .set({ deliveredAt: now, leasedUntil: null, claimToken: null, lastError: null })
    .where(and(eq(astrbotOutbox.id, id), eq(astrbotOutbox.claimToken, claimToken),
      sql`${astrbotOutbox.leasedUntil} > ${now}`, isNull(astrbotOutbox.deliveredAt), isNull(astrbotOutbox.failedAt)))
    .returning({ id: astrbotOutbox.id })
  return updated.length === 1
}

/**
 * 回执：标记本条投递失败。
 *
 * 达到 3 次尝试后落 failedAt 停止重试，避免无解的目标被永久重试；
 * 否则释放租约让下一次轮询重试。
 */
export async function failAstrbotOutbox(id: number, claimToken: string, reason: string, failedUmos: string[] | null = null) {
  const now = getServerDate()
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ umos: astrbotOutbox.umos, broadcast: astrbotOutbox.broadcast })
      .from(astrbotOutbox)
      .where(and(eq(astrbotOutbox.id, id), eq(astrbotOutbox.claimToken, claimToken),
        sql`${astrbotOutbox.leasedUntil} > ${now}`, isNull(astrbotOutbox.deliveredAt), isNull(astrbotOutbox.failedAt)))
      .for('update')
    if (!row) return false
    if (failedUmos && (!Array.isArray(row.umos) ||
      failedUmos.some((umo) => !row.umos?.includes(umo)))) return false
    const updated = await tx.update(astrbotOutbox).set({
      leasedUntil: null, claimToken: null,
      ...(failedUmos ? { umos: failedUmos } : {}),
      lastError: reason.slice(0, 500),
      failedAt: sql`CASE WHEN ${astrbotOutbox.attempts} >= 3 THEN ${now} ELSE NULL END`
    }).where(eq(astrbotOutbox.id, id)).returning({ id: astrbotOutbox.id })
    return updated.length === 1
  })
}
