import { z } from 'zod'
import { hasAdminPermission } from '~/utils/admin-permissions'
import { broadcastDenied, commandBroadcast } from '~~/server/services/broadcastPlayback'
import { notifySongsPlayed } from '~~/server/services/songPlayedService'
import { recordAdminAudit } from '~~/server/utils/admin-audit'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const bodySchema = z.discriminatedUnion('action', [
  z.strictObject({ device: z.uuid(), action: z.enum(['arm', 'disarm', 'release']) }),
  z.strictObject({ device: z.uuid(), action: z.literal('heartbeat'), endIfIdle: z.boolean().optional() }),
  z.strictObject({ device: z.uuid(), action: z.literal('start'), slotId: z.number().int().positive() }),
  z.strictObject({ device: z.uuid(), action: z.literal('stop'), run: z.uuid() }),
  z.strictObject({ device: z.uuid(), action: z.literal('advance'), run: z.uuid(), entryId: z.number().int().positive(), result: z.enum(['completed', 'skipped', 'failed']) })
])

export default defineEventHandler(async event => {
  const user = event.context.user
  const authSession = event.context.authSessionId
  if (!user || !authSession || !hasAdminPermission(user, 'playback:read') || !hasAdminPermission(user, 'playback:control')) throw broadcastDenied()
  const payload = bodySchema.safeParse(await readBody(event))
  if (!payload.success) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '播放操作参数无效')
  const { device, ...command } = payload.data
  const { updatedSongIds, audit, ...result } = await commandBroadcast({ device, userId: user.id, authSession: String(authSession) }, command,
    hasAdminPermission(user, 'playback:mark-played'))
  notifySongsPlayed(event, updatedSongIds)
  if (updatedSongIds.length) await recordAdminAudit(event, 'song.mark-played', {
    targetType: 'song', targetId: String(updatedSongIds[0]), summary: { source: 'playback', songIds: updatedSongIds }
  })
  for (const { action, slotId, date, reason, runId } of audit) {
    await recordAdminAudit(event, action, {
      targetType: slotId ? 'play-time' : 'broadcast', targetId: slotId ?? undefined, summary: { date, reason, runId }
    })
  }
  return result
})
