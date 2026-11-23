import { z } from 'zod'
import { hasAdminPermission } from '~/utils/admin-permissions'
import { readBroadcastPage } from '~~/server/services/broadcastPlayback'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const querySchema = z.object({ date: z.string(), slotId: z.coerce.number().int().positive().optional() })

export default defineEventHandler(event => {
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '排期查询参数无效')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return readBroadcastPage(query.data.date, query.data.slotId, hasAdminPermission(event.context.user, 'playback:remote-disarm'))
})
