import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import {
  CARD_CODE_DISPATCH_LIMITS,
  assignCardCodesToUsers,
  generateAndAssignCardCodes,
  type AssignOutcome
} from '~~/server/services/cardCodeAssignmentService'

/** 向指定用户派发库存券或新生成券。 */
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)
  const user = event.context.user!

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
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请选择接收用户')
  }

  const rawIds: unknown[] = Array.isArray(body.cardCodeIds) ? (body.cardCodeIds as unknown[]) : []
  const cardCodeIds: number[] = [
    ...new Set(
      rawIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ]

  const generateMode = body.countPerUser !== undefined
  const rawCountPerUser = typeof body.countPerUser === 'number' ||
    (typeof body.countPerUser === 'string' && body.countPerUser.trim())
    ? Number(body.countPerUser)
    : NaN
  if (generateMode && (!Number.isInteger(rawCountPerUser) || rawCountPerUser < 1 || rawCountPerUser > CARD_CODE_DISPATCH_LIMITS.perUser)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `每人派发张数必须为 1-${CARD_CODE_DISPATCH_LIMITS.perUser} 的整数`)
  }
  const countPerUser = generateMode ? rawCountPerUser : 0

  // 两种券来源互斥
  if (generateMode && cardCodeIds.length) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      '生成派发与勾选券不能同时提交，请只保留一种券来源'
    )
  }

  if (!generateMode && !cardCodeIds.length) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请至少选择一张点歌券')
  }

  if (!generateMode && cardCodeIds.length > CARD_CODE_DISPATCH_LIMITS.existingCards) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `单次最多派发 ${CARD_CODE_DISPATCH_LIMITS.existingCards} 张点歌券`)
  }

  if (targetUserIds.length > CARD_CODE_DISPATCH_LIMITS.recipients) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `单次最多派发给 ${CARD_CODE_DISPATCH_LIMITS.recipients} 位用户`)
  }

  if (generateMode && targetUserIds.length * countPerUser > CARD_CODE_DISPATCH_LIMITS.generatedCards) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `单次最多生成并派发 ${CARD_CODE_DISPATCH_LIMITS.generatedCards} 张点歌券`)
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

  const invalidRecipients: Array<{ userId: number; reason: string; error: { code: string } }> = []
  const targets: Array<{ id: number; name: string | null; username: string | null }> = []
  for (const userId of targetUserIds) {
    const target = targetMap.get(userId)
    if (!target) {
      invalidRecipients.push({ userId, reason: '用户不存在', error: { code: SERVER_ERROR_CODES.CARD_CODE_RECIPIENT_UNAVAILABLE } })
      continue
    }
    if (target.status === 'pending') {
      invalidRecipients.push({ userId, reason: '用户尚未通过审核', error: { code: SERVER_ERROR_CODES.CARD_CODE_RECIPIENT_UNAVAILABLE } })
      continue
    }
    targets.push({ id: target.id, name: target.name, username: target.username })
  }

  if (!targets.length) {
    throw createApiError(400, SERVER_ERROR_CODES.CARD_CODE_RECIPIENT_UNAVAILABLE, '没有可派发的用户', { invalidRecipients })
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
      failed: item.failures.map((entry) => ({ code: entry.code, reason: entry.reason, error: entry.error }))
    }))
  }
})
