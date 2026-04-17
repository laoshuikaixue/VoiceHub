import { and, eq, inArray, lte } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  notifications,
  songs,
  userSongRestrictions,
  voucherCodes,
  voucherRedeemTasks
} from '~/drizzle/schema'
import { AUTO_VOUCHER_RESTRICTION_REASON } from '~~/server/constants/voucher'
import { sendEmailNotificationToUser } from '~~/server/services/smtpService'
import { getPublicSiteOrigin, hashVoucherCode, hashVoucherRedeemToken } from '~~/server/utils/voucher'
import { getRedisClient, isRedisReady } from '~~/server/utils/redis'

const REDEEM_WINDOW_MS = 60 * 1000
const REDEEM_WINDOW_SECONDS = Math.ceil(REDEEM_WINDOW_MS / 1000)
const REDEEM_MAX_ATTEMPTS = 8
const localRedeemAttempts = new Map<number, { count: number; windowStart: number }>()
const LOCAL_REDEEM_SWEEP_INTERVAL_MS = 5 * 60 * 1000
let lastLocalSweepAt = 0

function sweepLocalRedeemAttempts(now: number) {
  if (now - lastLocalSweepAt < LOCAL_REDEEM_SWEEP_INTERVAL_MS) {
    return
  }

  for (const [userId, entry] of localRedeemAttempts.entries()) {
    if (now - entry.windowStart > REDEEM_WINDOW_MS) {
      localRedeemAttempts.delete(userId)
    }
  }

  lastLocalSweepAt = now
}

function assertLocalRedeemRateLimit(userId: number) {
  const now = Date.now()
  sweepLocalRedeemAttempts(now)

  const current = localRedeemAttempts.get(userId)

  if (!current || now - current.windowStart > REDEEM_WINDOW_MS) {
    localRedeemAttempts.set(userId, { count: 1, windowStart: now })
    return
  }

  if (current.count >= REDEEM_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((REDEEM_WINDOW_MS - (now - current.windowStart)) / 1000)
    throw createError({
      statusCode: 429,
      message: `兑换请求过于频繁，请在 ${retryAfterSeconds} 秒后重试`
    })
  }

  current.count += 1
  localRedeemAttempts.set(userId, current)
}

async function assertRedeemRateLimit(userId: number) {
  const isProduction = process.env.NODE_ENV === 'production'
  const redisConfigured = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim())

  if (redisConfigured && !isRedisReady() && isProduction) {
    throw createError({
      statusCode: 503,
      message: '兑换服务暂时不可用，请稍后重试'
    })
  }

  if (isRedisReady()) {
    const client = getRedisClient()

    if (client) {
      const key = `voucher:redeem:attempts:${userId}`

      try {
        const attempts = await client.incr(key)

        if (attempts === 1) {
          await client.expire(key, REDEEM_WINDOW_SECONDS)
        }

        if (attempts > REDEEM_MAX_ATTEMPTS) {
          const ttl = await client.ttl(key)
          const retryAfterSeconds = ttl > 0 ? ttl : REDEEM_WINDOW_SECONDS
          throw createError({
            statusCode: 429,
            message: `兑换请求过于频繁，请在 ${retryAfterSeconds} 秒后重试`
          })
        }

        return
      } catch (error: any) {
        if (error?.statusCode === 429) {
          throw error
        }

        if (isProduction) {
          throw createError({
            statusCode: 503,
            message: '兑换服务暂时不可用，请稍后重试'
          })
        }

        console.error('[Voucher] Redis 兑换限流失败，回退到本地限流:', error)
      }
    }
  }

  assertLocalRedeemRateLimit(userId)
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '请先登录后再兑换点歌券' })
  }

  await assertRedeemRateLimit(user.id)

  const body = await readBody<{ token?: string; code?: string }>(event)
  const token = (body?.token || '').trim()
  const code = (body?.code || '').trim()

  if (!token || !code) {
    throw createError({ statusCode: 400, message: 'token 和卡密不能为空' })
  }

  const tokenHash = hashVoucherRedeemToken(token)

  const taskResult = await db
    .select()
    .from(voucherRedeemTasks)
    .where(eq(voucherRedeemTasks.tokenHash, tokenHash))
    .limit(1)

  const task = taskResult[0]

  if (!task) {
    throw createError({ statusCode: 404, message: '兑换任务不存在或已失效' })
  }

  if (task.userId !== user.id) {
    throw createError({ statusCode: 403, message: '无权兑换此任务' })
  }

  if (task.status === 'CANCELLED') {
    throw createError({ statusCode: 400, message: '该兑换任务已取消' })
  }

  if (task.status === 'REDEEMED') {
    return {
      success: true,
      alreadyRedeemed: true,
      message: '该任务已兑换完成'
    }
  }

  const codeHash = hashVoucherCode(code)
  const voucherResult = await db
    .select()
    .from(voucherCodes)
    .where(eq(voucherCodes.codeHash, codeHash))
    .limit(1)

  const voucher = voucherResult[0]

  if (!voucher || voucher.status !== 'ACTIVE') {
    throw createError({ statusCode: 400, message: '卡密无效或已被使用' })
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    const expiredTransition = await tx
      .update(voucherRedeemTasks)
      .set({
        status: 'EXPIRED',
        updatedAt: now
      })
      .where(
        and(
          eq(voucherRedeemTasks.id, task.id),
          eq(voucherRedeemTasks.status, 'PENDING'),
          lte(voucherRedeemTasks.redeemDeadlineAt, now)
        )
      )
      .returning({ id: voucherRedeemTasks.id })

    if (expiredTransition.length > 0) {
      await tx
        .insert(userSongRestrictions)
        .values({
          userId: user.id,
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
    }

    const usedVoucher = await tx
      .update(voucherCodes)
      .set({
        status: 'USED',
        usedByUserId: user.id,
        usedAt: now,
        usedTaskId: task.id,
        updatedAt: now
      })
      .where(and(eq(voucherCodes.id, voucher.id), eq(voucherCodes.status, 'ACTIVE')))
      .returning({ id: voucherCodes.id })

    if (usedVoucher.length === 0) {
      throw createError({ statusCode: 400, message: '卡密已被使用，请更换后重试' })
    }

    const updatedTask = await tx
      .update(voucherRedeemTasks)
      .set({
        status: 'REDEEMED',
        redeemedAt: now,
        voucherCodeId: voucher.id,
        updatedAt: now
      })
      .where(
        and(
          eq(voucherRedeemTasks.id, task.id),
          inArray(voucherRedeemTasks.status, ['PENDING', 'EXPIRED'])
        )
      )
      .returning({ id: voucherRedeemTasks.id })

    if (updatedTask.length === 0) {
      throw createError({ statusCode: 400, message: '兑换任务状态已变化，请刷新后重试' })
    }

    const remainingExpiredTasks = await tx
      .select({ id: voucherRedeemTasks.id })
      .from(voucherRedeemTasks)
      .where(and(eq(voucherRedeemTasks.userId, user.id), eq(voucherRedeemTasks.status, 'EXPIRED')))
      .limit(1)

    if (remainingExpiredTasks.length === 0) {
      await tx
        .delete(userSongRestrictions)
        .where(
          and(
            eq(userSongRestrictions.userId, user.id),
            eq(userSongRestrictions.reason, AUTO_VOUCHER_RESTRICTION_REASON)
          )
        )
    }

    await tx.insert(notifications).values({
      userId: user.id,
      songId: task.songId,
      type: 'VOUCHER_REDEEM_SUCCESS',
      message: '点歌券兑换成功，点歌限制已自动解除。'
    })
  })

  try {
    const songResult = await db
      .select({ title: songs.title })
      .from(songs)
      .where(eq(songs.id, task.songId))
      .limit(1)

    const songTitle = songResult[0]?.title || '您的歌曲'
    const siteOrigin = getPublicSiteOrigin()

    await sendEmailNotificationToUser(
      user.id,
      '点歌券兑换成功',
      '点歌券兑换成功，点歌限制已自动解除。',
      undefined,
      'notification.voucherRedeemSuccess',
      {
        songTitle,
        message: '点歌券兑换成功，点歌限制已自动解除，您可以继续正常点歌。',
        actionUrl: siteOrigin || undefined
      }
    )
  } catch (error) {
    console.error('[Voucher] 发送兑换成功邮件通知失败:', error)
  }

  return {
    success: true,
    message: '兑换成功，点歌限制已解除'
  }
})
