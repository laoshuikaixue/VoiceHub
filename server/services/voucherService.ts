import crypto from 'node:crypto'
import { and, eq, gt, inArray, isNull, lt, lte } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import {
  notifications,
  songs,
  systemSettings,
  userSongRestrictions,
  users,
  voucherRedeemTasks
} from '~/drizzle/schema'
import {
  buildVoucherRedeemPath,
  buildVoucherRedeemToken,
  buildVoucherRedeemUrl,
  formatShanghaiDateTime,
  hashVoucherRedeemToken
} from '~~/server/utils/voucher'
import { AUTO_VOUCHER_RESTRICTION_REASON } from '~~/server/constants/voucher'
import { sendEmailNotificationToUser } from '~~/server/services/smtpService'

type PublishedSongInfo = {
  songId: number
  requesterId: number
  title: string
  artist: string
}

export type VoucherRequiredEmailJob = {
  userId: number
  songTitle: string
  deadline: Date
  token: string
}

type CreateVoucherTaskOptions = {
  sendRequiredEmails?: boolean
}

function isNormalUserRole(role: string | null | undefined) {
  return role === 'USER'
}

function buildRequiredMessage(songTitle: string, deadline: Date, token: string) {
  return `歌曲《${songTitle}》已通过排期审核，请在 ${formatShanghaiDateTime(deadline)} 前补交点歌券。兑换入口：${buildVoucherRedeemPath(token)}`
}

function buildReminderMessage(songTitle: string, deadline: Date, token: string) {
  return `歌曲《${songTitle}》的点歌券补交通道即将超时，截止时间：${formatShanghaiDateTime(deadline)}。请尽快兑换：${buildVoucherRedeemPath(token)}`
}

function buildExpiredMessage(songTitle: string, token: string) {
  return `您未在截止前完成歌曲《${songTitle}》的点歌券补交，当前已被限制点歌。您仍可补交并自动解除限制：${buildVoucherRedeemPath(token)}`
}

export async function createVoucherTasksForPublishedSongs(
  publishedSongs: PublishedSongInfo[],
  database: any = db,
  options: CreateVoucherTaskOptions = {}
) {
  if (publishedSongs.length === 0) {
    return { createdCount: 0, skippedCount: 0, requiredEmailJobs: [] as VoucherRequiredEmailJob[] }
  }

  const settingsResult = await database.select().from(systemSettings).limit(1)
  const settings = settingsResult[0]

  if (!settings?.enableVoucherPayment) {
    return {
      createdCount: 0,
      skippedCount: publishedSongs.length,
      requiredEmailJobs: [] as VoucherRequiredEmailJob[]
    }
  }

  const requesterIds = Array.from(new Set(publishedSongs.map((item) => item.requesterId)))
  const requesterRows: Array<{ id: number; role: string | null }> = requesterIds.length
    ? ((await database
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(inArray(users.id, requesterIds))) as Array<{ id: number; role: string | null }>)
    : []

  const requesterRoleMap = new Map(requesterRows.map((row) => [row.id, row.role]))

  let createdCount = 0
  let skippedCount = 0
  const requiredEmailJobs: VoucherRequiredEmailJob[] = []
  const shouldSendRequiredEmails = options.sendRequiredEmails !== false

  for (const song of publishedSongs) {
    const role = requesterRoleMap.get(song.requesterId)
    if (!isNormalUserRole(role)) {
      skippedCount += 1
      continue
    }

    const now = new Date()
    const deadline = new Date(now.getTime() + (settings.voucherRedeemDeadlineMinutes || 30) * 60 * 1000)
    const taskId = crypto.randomUUID()
    const token = buildVoucherRedeemToken(taskId)
    const tokenHash = hashVoucherRedeemToken(token)

    const inserted = await database
      .insert(voucherRedeemTasks)
      .values({
        id: taskId,
        userId: song.requesterId,
        songId: song.songId,
        status: 'PENDING',
        redeemDeadlineAt: deadline,
        tokenHash,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing({ target: voucherRedeemTasks.songId })
      .returning({ id: voucherRedeemTasks.id })

    if (inserted.length === 0) {
      skippedCount += 1
      continue
    }

    await database.insert(notifications).values({
      userId: song.requesterId,
      songId: song.songId,
      type: 'VOUCHER_REDEEM_REQUIRED',
      message: buildRequiredMessage(song.title, deadline, token)
    })

    requiredEmailJobs.push({
      userId: song.requesterId,
      songTitle: song.title,
      deadline,
      token
    })

    if (shouldSendRequiredEmails) {
      try {
        await sendEmailNotificationToUser(
          song.requesterId,
          '点歌券待补交',
          `歌曲《${song.title}》已通过排期审核，请在 ${formatShanghaiDateTime(deadline)} 前补交点歌券。`,
          undefined,
          'notification.voucherRedeemRequired',
          {
            songTitle: song.title,
            deadlineText: formatShanghaiDateTime(deadline),
            message: `歌曲《${song.title}》已通过排期审核，请在截止前补交点歌券。`,
            actionUrl: buildVoucherRedeemUrl(token, true)
          }
        )
      } catch (error) {
        console.error('[Voucher] 发送待补交邮件通知失败:', error)
      }
    }

    createdCount += 1
  }

  return { createdCount, skippedCount, requiredEmailJobs }
}

export async function sendVoucherRequiredEmails(jobs: VoucherRequiredEmailJob[]) {
  for (const job of jobs) {
    try {
      await sendEmailNotificationToUser(
        job.userId,
        '点歌券待补交',
        `歌曲《${job.songTitle}》已通过排期审核，请在 ${formatShanghaiDateTime(job.deadline)} 前补交点歌券。`,
        undefined,
        'notification.voucherRedeemRequired',
        {
          songTitle: job.songTitle,
          deadlineText: formatShanghaiDateTime(job.deadline),
          message: `歌曲《${job.songTitle}》已通过排期审核，请在截止前补交点歌券。`,
          actionUrl: buildVoucherRedeemUrl(job.token, true)
        }
      )
    } catch (error) {
      console.error('[Voucher] 发送待补交邮件通知失败:', error)
    }
  }
}

export async function processVoucherReminderJob() {
  const settingsResult = await db.select().from(systemSettings).limit(1)
  const settings = settingsResult[0]

  if (!settings?.enableVoucherPayment) {
    return { remindedCount: 0 }
  }

  const now = new Date()
  const remindUntil = new Date(now.getTime() + (settings.voucherRemindWindowMinutes || 5) * 60 * 1000)

  const tasks = await db
    .select({
      id: voucherRedeemTasks.id,
      userId: voucherRedeemTasks.userId,
      songId: voucherRedeemTasks.songId,
      redeemDeadlineAt: voucherRedeemTasks.redeemDeadlineAt,
      songTitle: songs.title
    })
    .from(voucherRedeemTasks)
    .innerJoin(songs, eq(voucherRedeemTasks.songId, songs.id))
    .where(
      and(
        eq(voucherRedeemTasks.status, 'PENDING'),
        isNull(voucherRedeemTasks.remindSentAt),
        gt(voucherRedeemTasks.redeemDeadlineAt, now),
        lte(voucherRedeemTasks.redeemDeadlineAt, remindUntil)
      )
    )

  let remindedCount = 0

  for (const task of tasks) {
    const token = buildVoucherRedeemToken(task.id)
    let shouldSendReminderEmail = false

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(voucherRedeemTasks)
        .set({ remindSentAt: now, updatedAt: now })
        .where(and(eq(voucherRedeemTasks.id, task.id), isNull(voucherRedeemTasks.remindSentAt)))
        .returning({ id: voucherRedeemTasks.id })

      if (updated.length === 0) {
        return
      }

      await tx.insert(notifications).values({
        userId: task.userId,
        songId: task.songId,
        type: 'VOUCHER_REDEEM_REMINDER',
        message: buildReminderMessage(task.songTitle, task.redeemDeadlineAt, token)
      })

      shouldSendReminderEmail = true

      remindedCount += 1
    })

    if (shouldSendReminderEmail) {
      try {
        await sendEmailNotificationToUser(
          task.userId,
          '点歌券即将超时',
          `歌曲《${task.songTitle}》的点歌券补交通道即将超时，截止时间：${formatShanghaiDateTime(task.redeemDeadlineAt)}。`,
          undefined,
          'notification.voucherRedeemReminder',
          {
            songTitle: task.songTitle,
            deadlineText: formatShanghaiDateTime(task.redeemDeadlineAt),
            message: `点歌券补交通道即将超时，请尽快完成兑换。`,
            actionUrl: buildVoucherRedeemUrl(token, true)
          }
        )
      } catch (error) {
        console.error('[Voucher] 发送补交提醒邮件通知失败:', error)
      }
    }
  }

  return { remindedCount }
}

export async function processVoucherExpiryJob() {
  const settingsResult = await db.select().from(systemSettings).limit(1)
  const settings = settingsResult[0]

  if (!settings?.enableVoucherPayment) {
    return { expiredCount: 0 }
  }

  const now = new Date()

  const tasks = await db
    .select({
      id: voucherRedeemTasks.id,
      userId: voucherRedeemTasks.userId,
      songId: voucherRedeemTasks.songId,
      songTitle: songs.title
    })
    .from(voucherRedeemTasks)
    .innerJoin(songs, eq(voucherRedeemTasks.songId, songs.id))
    .where(and(eq(voucherRedeemTasks.status, 'PENDING'), lte(voucherRedeemTasks.redeemDeadlineAt, now)))

  let expiredCount = 0

  for (const task of tasks) {
    const token = buildVoucherRedeemToken(task.id)
    let shouldSendExpiredEmail = false

    await db.transaction(async (tx) => {
      const expired = await tx
        .update(voucherRedeemTasks)
        .set({ status: 'EXPIRED', updatedAt: now })
        .where(and(eq(voucherRedeemTasks.id, task.id), eq(voucherRedeemTasks.status, 'PENDING')))
        .returning({ id: voucherRedeemTasks.id })

      if (expired.length === 0) {
        return
      }

      await tx
        .insert(userSongRestrictions)
        .values({
          userId: task.userId,
          reason: AUTO_VOUCHER_RESTRICTION_REASON,
          createdByUserId: null,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: userSongRestrictions.userId,
          set: {
            reason: AUTO_VOUCHER_RESTRICTION_REASON,
            createdByUserId: null,
            updatedAt: now
          }
        })

      await tx.insert(notifications).values({
        userId: task.userId,
        songId: task.songId,
        type: 'VOUCHER_REDEEM_EXPIRED',
        message: buildExpiredMessage(task.songTitle, token)
      })

      shouldSendExpiredEmail = true

      expiredCount += 1
    })

    if (shouldSendExpiredEmail) {
      try {
        await sendEmailNotificationToUser(
          task.userId,
          '点歌功能已限制',
          `您未在截止前完成歌曲《${task.songTitle}》的点歌券补交，当前已被限制点歌。`,
          undefined,
          'notification.voucherRedeemExpired',
          {
            songTitle: task.songTitle,
            message: '您仍可补交点歌券并自动解除限制。',
            actionUrl: buildVoucherRedeemUrl(token, true)
          }
        )
      } catch (error) {
        console.error('[Voucher] 发送超时邮件通知失败:', error)
      }
    }
  }

  return { expiredCount }
}
