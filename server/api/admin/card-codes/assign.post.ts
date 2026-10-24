import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import {
  assignCardCodesToUsers,
  generateAndAssignCardCodes,
  type AssignOutcome
} from '~~/server/services/cardCodeAssignmentService'

/**
 * 管理员派发点歌券。
 *
 * 支持一次派发多张券给多个接收人：
 * - userIds 为接收人列表（兼容旧版的单用户 userId 字段）
 * - 多张券按顺序轮流分配给各接收人（发牌式）；接收人多于券时，
 *   未获得券的接收人在 skippedRecipients 中明确返回，不静默漏发
 * - 逐张处理，单张失败不影响其它券，失败原因通过 failures 数组返回
 *
 * 另一种用法（generateMode）：
 * - 传 countPerUser 且不传 cardCodeIds，表示「按接收人现场生成并派发」，
 *   无需管理员先在列表里勾选库存券
 * - 每人固定获得 countPerUser 张新券，不存在轮流分配导致的漏发
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const body = (await readBody(event)) || {}

  // 接收人：兼容单用户 userId 与多用户 userIds 两种传参
  const rawUserIds: unknown[] = Array.isArray(body.userIds)
    ? (body.userIds as unknown[])
    : body.userId !== undefined
      ? [body.userId]
      : []
  const targetUserIds: number[] = [
    ...new Set(
      rawUserIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ]

  if (!targetUserIds.length) {
    throw createError({ statusCode: 400, message: '请选择要派发给的用户' })
  }

  const rawIds: unknown[] = Array.isArray(body.cardCodeIds) ? (body.cardCodeIds as unknown[]) : []
  const cardCodeIds: number[] = [
    ...new Set(
      rawIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ]

  // 每人派发张数：传了正整数就进入「现场生成并派发」模式，无需勾选库存券
  const rawCountPerUser = Number(body.countPerUser)
  const countPerUser = Number.isInteger(rawCountPerUser) && rawCountPerUser > 0 ? rawCountPerUser : 0
  const generateMode = countPerUser > 0

  if (!generateMode && !cardCodeIds.length) {
    throw createError({ statusCode: 400, message: '请至少选择一张点歌券' })
  }

  const MAX_ASSIGN_COUNT = 500
  if (!generateMode && cardCodeIds.length > MAX_ASSIGN_COUNT) {
    throw createError({ statusCode: 400, message: `单次最多派发 ${MAX_ASSIGN_COUNT} 张点歌券` })
  }

  const MAX_RECIPIENT_COUNT = 500
  if (targetUserIds.length > MAX_RECIPIENT_COUNT) {
    throw createError({ statusCode: 400, message: `单次最多派发给 ${MAX_RECIPIENT_COUNT} 位用户` })
  }

  // 生成模式下总券量同样受限，避免一次性生成过多券码
  const MAX_GENERATE_TOTAL = 1000
  if (generateMode && targetUserIds.length * countPerUser > MAX_GENERATE_TOTAL) {
    throw createError({
      statusCode: 400,
      message: `单次最多生成并派发 ${MAX_GENERATE_TOTAL} 张点歌券，请减少用户数或每人张数`
    })
  }

  const targetRows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      status: users.status
    })
    .from(users)
    .where(inArray(users.id, targetUserIds))
  const targetMap = new Map(targetRows.map((row) => [row.id, row]))

  // 逐人校验：不存在或未过审的用户单独列出，不影响其他人派发
  const invalidRecipients: Array<{ userId: number; reason: string }> = []
  const targets: Array<{ id: number; name: string | null; username: string | null }> = []
  for (const userId of targetUserIds) {
    const target = targetMap.get(userId)
    if (!target) {
      invalidRecipients.push({ userId, reason: '用户不存在' })
      continue
    }
    if (target.status === 'pending') {
      invalidRecipients.push({ userId, reason: '尚未通过审核，无法派发点歌券' })
      continue
    }
    targets.push({ id: target.id, name: target.name, username: target.username })
  }

  if (!targets.length) {
    throw createError({
      statusCode: 400,
      message: invalidRecipients.length
        ? `没有可派发的用户：${invalidRecipients.map((item) => `#${item.userId} ${item.reason}`).join('；')}`
        : '没有可派发的用户'
    })
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const notify = body.notify !== false

  const actor = { id: user.id, name: user.name, username: user.username }

  const result = generateMode
    ? await generateAndAssignCardCodes({
        targets,
        countPerUser,
        actor,
        note: note || null,
        notify,
        prefix: typeof body.prefix === 'string' ? body.prefix.trim().toUpperCase() : ''
      })
    : await assignCardCodesToUsers({
        cardCodeIds,
        targets,
        actor,
        note: note || null,
        notify
      })

  const failures: AssignOutcome[] = result.perUser.flatMap((item) => item.failures)

  // 生成模式额外返回本次新生成的券码，便于管理员核对与转告
  const generatedCodes = generateMode ? (result as { generatedCodes?: string[] }).generatedCodes || [] : []

  return {
    success: result.summary.assignedCount > 0,
    total: result.summary.assignedCount + result.summary.failedCount,
    assignedCount: result.summary.assignedCount,
    failedCount: result.summary.failedCount,
    recipients: result.summary.recipients,
    servedRecipients: result.summary.servedRecipients,
    generateMode,
    ...(generateMode ? { generatedCodes } : {}),
    skippedRecipients: result.skipped.map((item) => ({
      id: item.id,
      name: item.name,
      username: item.username
    })),
    invalidRecipients,
    failures,
    perUser: result.perUser.map((item) => ({
      user: {
        id: item.target.id,
        name: item.target.name,
        username: item.target.username
      },
      assigned: item.assigned.map((entry) => entry.code),
      failed: item.failures.map((entry) => ({ code: entry.code, reason: entry.reason }))
    }))
  }
})
