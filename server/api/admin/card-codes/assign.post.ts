import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import {
  assignCardCodesToUser,
  type AssignOutcome
} from '~~/server/services/cardCodeAssignmentService'

/**
 * 管理员派发点歌券给指定用户。
 *
 * 支持一次派发多张券：逐张处理，单张失败不影响其它券，
 * 失败原因通过 failures 数组返回。
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

  const targetUserId = Number(body.userId)
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
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

  if (!cardCodeIds.length) {
    throw createError({ statusCode: 400, message: '请至少选择一张点歌券' })
  }

  const MAX_ASSIGN_COUNT = 500
  if (cardCodeIds.length > MAX_ASSIGN_COUNT) {
    throw createError({ statusCode: 400, message: `单次最多派发 ${MAX_ASSIGN_COUNT} 张点歌券` })
  }

  const targetRows = await db
    .select({ id: users.id, name: users.name, username: users.username, status: users.status })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)
  const target = targetRows[0]
  if (!target) {
    throw createError({ statusCode: 404, message: '目标用户不存在' })
  }
  if (target.status === 'pending') {
    throw createError({ statusCode: 400, message: '目标用户尚未通过审核，无法派发点歌券' })
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const notify = body.notify !== false

  const outcomes = await assignCardCodesToUser({
    cardCodeIds,
    target: { id: target.id, name: target.name, username: target.username },
    actor: { id: user.id, name: user.name, username: user.username },
    note: note || null,
    notify
  })

  const succeeded = outcomes.filter((item) => item.success)
  const failures: AssignOutcome[] = outcomes.filter((item) => !item.success)

  return {
    success: succeeded.length > 0,
    total: outcomes.length,
    assignedCount: succeeded.length,
    failedCount: failures.length,
    failures,
    data: succeeded
  }
})
