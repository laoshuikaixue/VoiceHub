import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { runSongQuotaDrizzleTransaction } from '#server/services/songQuotaDrizzleAdapter'
import { adjustPermanentSongQuotaByOperation } from '#server/services/songQuotaService'
import { fingerprintQuotaAdjustment } from '#server/utils/song-quota-policy'
import { getServerDate } from '#server/utils/serverTime'
import {
  adminSongQuotaAdjustmentSchema,
  requireSongQuotaAdministrator,
  throwInvalidSongQuotaInput
} from '#server/api/admin/song-quotas/_shared'

export default defineEventHandler(async (event) => {
  const administrator = requireSongQuotaAdministrator(event)
  const parsed = adminSongQuotaAdjustmentSchema.safeParse(await readBody(event))
  if (!parsed.success) throwInvalidSongQuotaInput()
  const input = parsed.data
  const requestFingerprint = fingerprintQuotaAdjustment({
    userId: input.userId,
    delta: input.amount,
    operation: input.operation,
    publicDescription: input.publicDescription,
    internalNote: input.internalNote,
    administratorId: administrator.id
  })
  const result = await runSongQuotaDrizzleTransaction(db, (tx) =>
    adjustPermanentSongQuotaByOperation(tx, {
      userId: input.userId,
      operation: input.operation,
      amount: input.amount,
      source: 'ADMIN_ADJUST',
      now: getServerDate(),
      idempotencyKey: `admin-adjust:${input.requestId}`,
      requestFingerprint,
      administratorId: administrator.id,
      publicDescription: input.publicDescription,
      internalNote: input.internalNote
    })
  )
  return { account: result.account, transaction: { id: result.transaction.id } }
})
