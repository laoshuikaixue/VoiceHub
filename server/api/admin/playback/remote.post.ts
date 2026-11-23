import { z } from 'zod'
import { hasAdminPermission } from '~/utils/admin-permissions'
import { broadcastDenied, commandRemoteBroadcast } from '~~/server/services/broadcastPlayback'
import { recordAdminAudit } from '~~/server/utils/admin-audit'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const schema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('disarm'), target: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ action: z.literal('emergency-stop') })
])

export default defineEventHandler(async event => {
  const input = schema.safeParse(await readBody(event))
  if (!input.success) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '播放操作参数无效')
  const user = event.context.user
  const disarm = input.data.action === 'disarm'
  const permission = disarm ? 'playback:remote-disarm' : 'playback:emergency-stop'
  if (!event.context.authSessionId || !hasAdminPermission(user, 'playback:read') || !hasAdminPermission(user, permission)) throw broadcastDenied()
  const result = await commandRemoteBroadcast(input.data)
  await recordAdminAudit(event, disarm ? 'playback.remote-disarm' : 'playback.emergency-stop', {
    targetType: result.slotId ? 'play-time' : 'broadcast',
    targetId: result.slotId ?? undefined,
    summary: { account: result.account, date: result.date, runId: result.runId }
  })
  return { runId: result.runId }
})
