import { recycleCardCodeAssignments } from '~~/server/services/cardCodeAssignmentService'

/**
 * 管理员回收已派发的点歌券。
 * 回收后点歌券回到 AVAILABLE 池中，可重新派发。
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
  const rawIds: unknown[] = Array.isArray(body.assignmentIds) ? (body.assignmentIds as unknown[]) : []
  const assignmentIds: number[] = [
    ...new Set(
      rawIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ]

  if (!assignmentIds.length) {
    throw createError({ statusCode: 400, message: '请至少选择一条派发记录' })
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  const outcomes = await recycleCardCodeAssignments({
    assignmentIds,
    actor: { id: user.id, name: user.name, username: user.username },
    reason: reason || null
  })

  const succeeded = outcomes.filter((item) => item.success)
  const failures = outcomes.filter((item) => !item.success)

  return {
    success: succeeded.length > 0,
    total: outcomes.length,
    recycledCount: succeeded.length,
    failedCount: failures.length,
    failures
  }
})
