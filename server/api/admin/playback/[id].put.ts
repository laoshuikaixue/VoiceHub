import { z } from 'zod'
import { hasAdminPermission } from '~/utils/admin-permissions'
import { broadcastDenied, saveBroadcastPolicy } from '~~/server/services/broadcastPlayback'
import { recordAdminAudit } from '~~/server/utils/admin-audit'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const policySchema = z.strictObject({
  autoStart: z.boolean().optional(), stopAtEnd: z.boolean().optional(), markPlayed: z.boolean().optional()
}).refine(value => Object.keys(value).length > 0)

export default defineEventHandler(async event => {
  const user = event.context.user
  if (!hasAdminPermission(user, 'playback:read') || !hasAdminPermission(user, 'playback:configure')) throw broadcastDenied()
  const input = policySchema.safeParse(await readBody(event))
  const id = Number(getRouterParam(event, 'id'))
  if (!input.success || !Number.isSafeInteger(id) || id < 1) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '时段播放设置无效')
  }
  if (input.data.markPlayed !== undefined && !hasAdminPermission(user, 'playback:mark-played')) throw broadcastDenied()
  const policy = await saveBroadcastPolicy(id, input.data)
  await recordAdminAudit(event, 'playback.configure', { targetType: 'play-time', targetId: String(id), summary: input.data })
  return policy
})
