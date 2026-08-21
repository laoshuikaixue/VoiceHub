import { requestSongForUser } from '#server/services/songRequestService'
import { createApiError } from '#server/utils/apiError'
import { isSongAdministrator, validateAdminSongAddBody } from '#server/utils/song-request-policy'

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createApiError(405, 'HTTP_METHOD_NOT_ALLOWED', 'Method Not Allowed')
  }

  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }
  if (!isSongAdministrator(user.role)) {
    throw createApiError(403, 'COMMON_INSUFFICIENT_PERMISSION', '权限不足')
  }

  const idempotencyKey = getHeader(event, 'idempotency-key')?.trim()
  if (!idempotencyKey) {
    throw createApiError(400, 'COMMON_INVALID_PARAMS', '缺少 Idempotency-Key 请求头')
  }

  const validatedBody = validateAdminSongAddBody(await readBody(event), user.id)
  const { requesterId: _requesterId, ...body } = validatedBody
  const song = await requestSongForUser(event, user, body, {
    requestId: idempotencyKey
  })
  return { success: true, song }
})
