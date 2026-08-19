import { getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { createSongQuotaDrizzleAdapter } from '#server/services/songQuotaDrizzleAdapter'
import {
  buildPublicSongQuotaTransaction,
  listSongQuotaTransactions
} from '#server/services/songQuotaService'
import {
  enforceOpenSongQuotaRateLimit,
  openSongQuotaTransactionQuerySchema,
  requireOpenSongQuotaApiKey,
  requireOpenSongQuotaUser,
  throwInvalidOpenSongQuotaInput
} from '#server/api/open/song-quotas/_shared'

export default defineEventHandler(async (event) => {
  const apiKey = requireOpenSongQuotaApiKey(event)
  const parsed = openSongQuotaTransactionQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throwInvalidOpenSongQuotaInput()
  const user = await requireOpenSongQuotaUser(parsed.data.userId)
  await enforceOpenSongQuotaRateLimit(event, apiKey.id, user.id)
  const result = await listSongQuotaTransactions(createSongQuotaDrizzleAdapter(db), {
    userId: user.id,
    page: parsed.data.page,
    limit: parsed.data.limit
  })
  return {
    items: result.items.map(buildPublicSongQuotaTransaction),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit)
    }
  }
})
