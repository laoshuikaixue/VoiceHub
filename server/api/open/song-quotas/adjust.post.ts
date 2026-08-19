import { getHeader, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { runSongQuotaDrizzleTransaction } from '#server/services/songQuotaDrizzleAdapter'
import { adjustPermanentSongQuota } from '#server/services/songQuotaService'
import { fingerprintQuotaAdjustment } from '#server/utils/song-quota-policy'
import { getServerDate } from '#server/utils/serverTime'
import {
  enforceOpenSongQuotaRateLimit,
  openSongQuotaAdjustmentSchema,
  requireOpenSongQuotaApiKey,
  requireOpenSongQuotaUser,
  throwInvalidOpenSongQuotaInput
} from '#server/api/open/song-quotas/_shared'

export default defineEventHandler(async (event) => {
  const apiKey = requireOpenSongQuotaApiKey(event)
  const idempotencyKey = getHeader(event, 'Idempotency-Key')?.trim() ?? ''
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throwInvalidOpenSongQuotaInput()
  }
  const parsed = openSongQuotaAdjustmentSchema.safeParse(await readBody(event))
  if (!parsed.success) throwInvalidOpenSongQuotaInput()
  const input = parsed.data
  const user = await requireOpenSongQuotaUser(input.userId)
  await enforceOpenSongQuotaRateLimit(event, apiKey.id, user.id)
  const requestFingerprint = fingerprintQuotaAdjustment({
    userId: user.id,
    delta: input.delta,
    externalReference: input.externalReference,
    publicDescription: input.publicDescription,
    internalNote: input.internalNote
  })
  const result = await runSongQuotaDrizzleTransaction(db, (tx) =>
    adjustPermanentSongQuota(tx, {
      userId: user.id,
      delta: input.delta,
      source: 'OPEN_API_ADJUST',
      now: getServerDate(),
      idempotencyKey: `open-adjust:${apiKey.id}:${idempotencyKey}`,
      requestFingerprint,
      apiKeyId: apiKey.id,
      externalReference: input.externalReference,
      publicDescription: input.publicDescription,
      internalNote: input.internalNote
    })
  )
  return {
    userId: user.id,
    permanentBalance: result.account.permanentBalance,
    totalBalance: result.account.periodicBalance + result.account.permanentBalance,
    transactionId: result.transaction.id
  }
})
