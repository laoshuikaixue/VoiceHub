import { createHash, randomUUID } from 'node:crypto'
import { updatePending } from '~~/scripts/web-update/state.mjs'
import { and, asc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { authSessions, broadcastPlayback, broadcastStarts, playTimes, schedules, songs, users } from '~/drizzle/schema'
import { getBeijingDateString, getBeijingWeekday, parseToBeijingTime } from '~/utils/timeUtils'
import { summarizeScheduleDuration } from '~/utils/schedule-duration'
import { getServerDate } from '~~/server/utils/serverTime'
import { parseScheduleDateQuery } from '~~/server/utils/schedule-date-query'
import { slotAppliesToWeekday } from '~~/server/utils/play-slot'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES as codes } from '~~/server/config/constants'
import { updateSongPlayed } from './songPlayedService'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Slot = typeof playTimes.$inferSelect
type Lease = typeof broadcastPlayback.$inferSelect
type Actor = Pick<Lease, 'userId' | 'authSession' | 'device'>
type BroadcastEndReason = 'playlist-completed' | 'slot-end' | 'playlist-changed' | 'source-failed'
type BroadcastAudit =
  | { action: 'playback.unattended-enable' | 'playback.unattended-disable'; reason?: 'page-released'; slotId?: never; date?: never; runId?: never }
  | { action: 'playback.auto-start' | 'playback.auto-end'; slotId: number | null; date: string | null; runId: string | null; reason?: BroadcastEndReason }
const LEASE_MS = 12_000
const START_GRACE_MS = 5_000
const emptyRun = { run: null, playDate: null, slotId: null, queue: null, cursor: 0 }

export type BroadcastCommand =
  | { action: 'arm' | 'disarm' | 'release' }
  | { action: 'heartbeat'; endIfIdle?: boolean }
  | { action: 'start'; slotId: number }
  | { action: 'stop'; run: string }
  | { action: 'advance'; run: string; entryId: number; result: 'completed' | 'skipped' | 'failed' }

export function broadcastUnavailable() {
  return createApiError(409, codes.BROADCAST_UNAVAILABLE, '播出时段、排期或播出设备状态已变化')
}

export function broadcastDenied() {
  return createApiError(403, codes.BROADCAST_ACCESS, '没有播放控制权限')
}

function broadcastWindow(date: string, slot: Slot) {
  if (!slot.enabled || !slot.startTime || !slot.endTime || slot.startTime >= slot.endTime ||
      !slotAppliesToWeekday(slot.weekdays, getBeijingWeekday(date))) return null
  const start = parseToBeijingTime(`${date} ${slot.startTime}`).getTime()
  const end = parseToBeijingTime(`${date} ${slot.endTime}`).getTime()
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null
}

async function readQueue(source: Tx | typeof db, date: string, slotId: number) {
  const { startOfDay, endOfDay } = parseScheduleDateQuery(date)!
  return source.select({
    id: schedules.id,
    sequence: schedules.sequence,
    song: {
      id: songs.id, title: songs.title, artist: songs.artist, musicPlatform: songs.musicPlatform,
      musicId: songs.musicId, musicSourceData: songs.musicSourceData, playUrl: songs.playUrl,
      durationSeconds: songs.durationSeconds, played: songs.played
    }
  }).from(schedules).innerJoin(songs, eq(schedules.songId, songs.id))
    .where(and(eq(schedules.isDraft, false), eq(schedules.playTimeId, slotId),
      gte(schedules.playDate, startOfDay), lt(schedules.playDate, endOfDay)))
    .orderBy(asc(schedules.sequence), asc(schedules.createdAt), asc(schedules.id))
}

function policy(slot: Slot) {
  return { autoStart: slot.broadcastAutoStart, stopAtEnd: slot.broadcastStopAtEnd, markPlayed: slot.broadcastMarkPlayed }
}

export async function readBroadcastPage(date: string, slotId: number | undefined, includeRemote = false) {
  // 在读列表前即校验日期，包括没有启用时段的站点。
  parseScheduleDateQuery(date)
  const slots = await db.select().from(playTimes).orderBy(asc(playTimes.startTime), asc(playTimes.id))
  const available = slots.flatMap(slot => {
    const window = broadcastWindow(date, slot)
    return window ? [{ id: slot.id, name: slot.name, ...window, ...policy(slot) }] : []
  })
  const selected = available.find(slot => slot.id === slotId) ?? available[0]
  const entries = selected ? await readQueue(db, date, selected.id) : []
  const controller = includeRemote ? await readOnlineController(db, getServerDate()) : null
  const remoteUnattended = controller?.lease.armedAt ? {
    account: controller.username, target: unattendedTarget(controller.lease), playing: Boolean(controller.lease.run)
  } : null
  return { slots: available, slotId: selected?.id ?? null, entries, duration: summarizeScheduleDuration(entries), timestamp: getServerDate().getTime(), remoteUnattended }
}

export async function lockBroadcast(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('voicehub.broadcast'))`)
}

async function readOnlineController(source: Tx | typeof db, now: Date) {
  const [controller] = await source.select({ username: users.username, lease: broadcastPlayback })
    .from(broadcastPlayback)
    .innerJoin(users, eq(users.id, broadcastPlayback.userId))
    .innerJoin(authSessions, and(eq(authSessions.userId, users.id), sql`${authSessions.id}::text = ${broadcastPlayback.authSession}`))
    .where(and(eq(broadcastPlayback.id, 1), gt(broadcastPlayback.expiresAt, now), isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, now), eq(users.status, 'active')))
  return controller
}

function unattendedTarget(lease: Lease) {
  return createHash('sha256').update(JSON.stringify([lease.device, lease.authSession, lease.armedAt])).digest('hex')
}

export type RemoteBroadcastCommand = { action: 'disarm'; target: string } | { action: 'emergency-stop' }

export async function commandRemoteBroadcast(command: RemoteBroadcastCommand) {
  return db.transaction(async tx => {
    await lockBroadcast(tx)
    const now = getServerDate()
    if (command.action === 'disarm') {
      const controller = await readOnlineController(tx, now)
      if (!controller?.lease.armedAt || unattendedTarget(controller.lease) !== command.target) throw broadcastUnavailable()
      const { lease, username } = controller
      await tx.update(broadcastPlayback).set({ armedAt: null }).where(eq(broadcastPlayback.id, 1))
      return { runId: lease.run, slotId: lease.slotId, date: lease.playDate, account: username }
    }

    const lease = await tx.query.broadcastPlayback.findFirst({ where: eq(broadcastPlayback.id, 1) })
    if (lease) {
      // 保留后续时段的值守，同时阻止当前开播窗口在紧急停播后接续启动。
      await tx.update(broadcastPlayback).set({
        ...emptyRun, armedAt: lease.armedAt ? new Date(now.getTime() + 1) : null
      }).where(eq(broadcastPlayback.id, 1))
    }
    return { runId: lease?.run ?? null, slotId: lease?.slotId ?? null, date: lease?.playDate ?? null, account: null }
  })
}

export async function readScheduleBroadcastContext(
  source: Tx | typeof db, date: string, slotId: number | null, wholeDay: boolean
) {
  if (!wholeDay && slotId === null) return { slots: [], account: null, confirmation: null }
  const rows = await source.select().from(playTimes)
    .where(wholeDay ? undefined : eq(playTimes.id, slotId!))
    .orderBy(asc(playTimes.startTime), asc(playTimes.id)).for('share')
  const enabled = rows.filter(slot => slot.broadcastAutoStart && broadcastWindow(date, slot))
  if (!enabled.length) return { slots: [], account: null, confirmation: null }

  const controller = await readOnlineController(source, getServerDate())
  const account = controller?.lease.armedAt ? controller.username : null
  const slots = enabled.map(slot => ({ id: slot.id, name: slot.name, startTime: slot.startTime, endTime: slot.endTime }))
  const confirmation = createHash('sha256')
    .update(JSON.stringify([date, slotId, wholeDay, slots, account, controller?.lease.armedAt ?? null]))
    .digest('hex')
  return { slots, account, confirmation }
}

export async function assertScheduleBroadcastConfirmed(
  tx: Tx, date: string, slotId: number | null, wholeDay: boolean, confirmation: unknown
) {
  const context = await readScheduleBroadcastContext(tx, date, slotId, wholeDay)
  if ((context.confirmation !== null || typeof confirmation === 'string') && context.confirmation !== confirmation) {
    throw createApiError(409, codes.SCHEDULE_BROADCAST_CONFIRMATION_REQUIRED, '自动播放信息已变化，请重新打开发布确认')
  }
}

export async function saveBroadcastPolicy(
  slotId: number, input: { autoStart?: boolean; stopAtEnd?: boolean; markPlayed?: boolean }
) {
  return db.transaction(async tx => {
    await lockBroadcast(tx)
    const slot = await tx.query.playTimes.findFirst({ where: eq(playTimes.id, slotId) })
    if (!slot?.enabled) throw broadcastUnavailable()
    const changes: Partial<Slot> = {}
    if (input.autoStart !== undefined && input.autoStart !== slot.broadcastAutoStart) {
      changes.broadcastAutoStart = input.autoStart
      changes.broadcastAutoChangedAt = getServerDate()
    }
    if (input.stopAtEnd !== undefined) changes.broadcastStopAtEnd = input.stopAtEnd
    if (input.markPlayed !== undefined) changes.broadcastMarkPlayed = input.markPlayed
    if (Object.keys(changes).length) await tx.update(playTimes).set(changes).where(eq(playTimes.id, slotId))
    return policy({ ...slot, ...changes })
  })
}

export async function commandBroadcast(actor: Actor, command: BroadcastCommand, canMark: boolean) {
  return db.transaction(async tx => {
    await lockBroadcast(tx)
    if ((command.action === 'arm' || command.action === 'start') && await updatePending(process.env.VOICEHUB_UPDATE_DIR)) {
      throw createApiError(409, codes.BROADCAST_BUSY, '系统正在升级，请稍后重试')
    }
    const now = getServerDate()
    const today = getBeijingDateString(now)
    const timestamp = now.getTime()
    const current = await tx.query.broadcastPlayback.findFirst({ where: eq(broadcastPlayback.id, 1) })
    const valid = current && current.expiresAt > now ? current : null
    const owned = valid?.device === actor.device && valid.userId === actor.userId && valid.authSession === actor.authSession
    const audit: BroadcastAudit[] = []
    const empty = { timestamp, armed: false, expiresAt: null, active: null, updatedSongIds: [] as number[], marked: false, audit }
    if (!owned && command.action === 'heartbeat') return empty
    if (!owned && command.action === 'release') return empty
    if (valid && !owned) throw createApiError(409, codes.BROADCAST_BUSY, '另一台设备正在控制播放')
    if (!owned && command.action !== 'arm' && command.action !== 'start') throw broadcastUnavailable()

    const lease: Lease = owned ? { ...valid } : { id: 1, ...actor, ...emptyRun, armedAt: null, expiresAt: now }
    if (command.action === 'release') {
      if (lease.armedAt) audit.push({ action: 'playback.unattended-disable', reason: 'page-released' })
      await tx.delete(broadcastPlayback).where(eq(broadcastPlayback.id, 1))
      return empty
    }

    if (command.action === 'arm' && !lease.armedAt) {
      lease.armedAt = now
      audit.push({ action: 'playback.unattended-enable' })
    }
    if (command.action === 'disarm' && lease.armedAt) {
      lease.armedAt = null
      audit.push({ action: 'playback.unattended-disable' })
    }
    const updatedSongIds: number[] = []
    let marked = false

    async function start(slot: Slot, automatic: boolean) {
      const window = broadcastWindow(today, slot)
      if (!window || window.end <= timestamp) return false
      const entries = await readQueue(tx, today, slot.id)
      if (!entries.length) return false
      const claimed = await tx.insert(broadcastStarts).values({ playDate: today, slotId: slot.id })
        .onConflictDoNothing().returning({ slotId: broadcastStarts.slotId })
      if (automatic && !claimed.length) return false
      const runId = randomUUID()
      Object.assign(lease, { run: runId, playDate: today, slotId: slot.id, queue: entries.map(entry => entry.id), cursor: 0 })
      if (automatic) audit.push({ action: 'playback.auto-start', slotId: slot.id, date: today, runId })
      return true
    }

    function endAutomatically(reason: BroadcastEndReason) {
      audit.push({ action: 'playback.auto-end', slotId: lease.slotId, date: lease.playDate, runId: lease.run, reason })
      Object.assign(lease, emptyRun)
    }

    if (command.action === 'start') {
      if (lease.run) throw broadcastUnavailable()
      const slot = await tx.query.playTimes.findFirst({ where: eq(playTimes.id, command.slotId) })
      if (!slot || !await start(slot, false)) throw broadcastUnavailable()
    }

    if (command.action === 'stop' || command.action === 'advance') {
      if (lease.run && command.run !== lease.run) throw broadcastUnavailable()
      if (command.action === 'stop') Object.assign(lease, emptyRun)
    }

    if (command.action === 'heartbeat' && lease.armedAt && !lease.run) {
      const slots = await tx.select().from(playTimes).where(and(eq(playTimes.broadcastAutoStart, true), eq(playTimes.enabled, true)))
        .orderBy(asc(playTimes.startTime), asc(playTimes.id))
      for (const slot of slots) {
        const window = broadcastWindow(today, slot)
        if (window && window.start >= lease.armedAt.getTime() && window.start >= (slot.broadcastAutoChangedAt?.getTime() ?? 0) &&
          timestamp >= window.start && timestamp < window.start + START_GRACE_MS && await start(slot, true)) break
      }
    }

    let active = null
    if (lease.run && lease.slotId && lease.playDate && lease.queue) {
      const slot = await tx.query.playTimes.findFirst({ where: eq(playTimes.id, lease.slotId) })
      const window = slot && broadcastWindow(lease.playDate, slot)
      const entries = window ? await readQueue(tx, lease.playDate, lease.slotId) : []
      const stable = entries.length === lease.queue.length && entries.every((entry, index) => entry.id === lease.queue![index])
      if (!slot || !window || !stable) {
        endAutomatically('playlist-changed')
      } else if (timestamp >= window.end && (slot.broadcastStopAtEnd || (command.action === 'heartbeat' && command.endIfIdle))) {
        endAutomatically('slot-end')
      } else {
        if (command.action === 'advance') {
          const entry = entries[lease.cursor]
          if (!entry || entry.id !== command.entryId) throw broadcastUnavailable()
          if (command.result === 'completed' && canMark && slot.broadcastMarkPlayed) {
            updatedSongIds.push(...await updateSongPlayed(tx, [entry.song.id], actor.userId))
            marked = true
            entry.song.played = true
          }
          lease.cursor++
          if (lease.cursor >= entries.length || timestamp >= window.end) {
            if (command.result === 'completed') endAutomatically(lease.cursor >= entries.length ? 'playlist-completed' : 'slot-end')
            else if (command.result === 'failed') endAutomatically(timestamp >= window.end ? 'slot-end' : 'source-failed')
            else Object.assign(lease, emptyRun)
          }
        }
        if (lease.run) active = {
          id: lease.run, date: lease.playDate!, slotId: slot.id, slotName: slot.name, cursor: lease.cursor,
          entries, duration: summarizeScheduleDuration(entries), ...window, ...policy(slot), closing: timestamp >= window.end
        }
      }
    }

    if (!lease.armedAt && !lease.run) {
      await tx.delete(broadcastPlayback).where(eq(broadcastPlayback.id, 1))
      return { ...empty, updatedSongIds, marked }
    }
    lease.expiresAt = new Date(timestamp + LEASE_MS)
    await tx.insert(broadcastPlayback).values(lease).onConflictDoUpdate({ target: broadcastPlayback.id, set: lease })
    return { timestamp, armed: lease.armedAt !== null, expiresAt: lease.expiresAt.getTime(), active, updatedSongIds, marked, audit }
  })
}
