import { CARD_CODE_DISPATCH_LIMITS, recycleCardCodeAssignments } from '~~/server/services/cardCodeAssignmentService'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

/** 回收派发券到可用池。 */
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)
  const user = event.context.user!

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
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请至少选择一条派发记录')
  }
  if (assignmentIds.length > CARD_CODE_DISPATCH_LIMITS.existingCards) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `单次最多回收 ${CARD_CODE_DISPATCH_LIMITS.existingCards} 条派发记录`)
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
