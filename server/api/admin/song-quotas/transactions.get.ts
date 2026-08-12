import { getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import {
  buildAdminSongQuotaTransaction,
  listSongQuotaTransactions
} from '~~/server/services/songQuotaService'
import {
  adminSongQuotaTransactionQuerySchema,
  requireSongQuotaAdministrator,
  throwInvalidSongQuotaInput
} from './_shared'

export default defineEventHandler(async (event) => {
  requireSongQuotaAdministrator(event)
  const parsed = adminSongQuotaTransactionQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throwInvalidSongQuotaInput()
  const { page, limit, userId, administratorId, quotaType, source, from, to } = parsed.data
  const result = await listSongQuotaTransactions(createSongQuotaDrizzleAdapter(db), {
    page, limit, userId, administratorId, quotaType, source, from, to
  })
  return {
    items: result.items.map(buildAdminSongQuotaTransaction),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit)
    }
  }
})
