import { listUserAssignedCardCodes } from '~~/server/services/cardCodeAssignmentService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { formatDateTime } from '~/utils/timeUtils'

/** 查询本人持有的未使用点歌券。 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.CARD_CODE_AUTH_REQUIRED, '未授权访问')
  }

  const rows = await listUserAssignedCardCodes(user.id)

  return {
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      assignedAt: row.assignedAt,
      assignedAtDisplay: row.assignedAt ? formatDateTime(row.assignedAt) : null,
      note: row.note,
      assignmentId: row.assignmentId,
      assignedByName: row.assignedByName,
      notifyStatus: row.notifyStatus
    }))
  }
})
