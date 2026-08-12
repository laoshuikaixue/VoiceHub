import { getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import { listSongQuotaAccounts } from '~~/server/services/songQuotaService'
import {
  adminSongQuotaAccountQuerySchema,
  requireSongQuotaAdministrator,
  throwInvalidSongQuotaInput
} from './_shared'

export default defineEventHandler(async (event) => {
  requireSongQuotaAdministrator(event)
  const parsed = adminSongQuotaAccountQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throwInvalidSongQuotaInput()
  const { page, limit, search } = parsed.data
  const result = await listSongQuotaAccounts(createSongQuotaDrizzleAdapter(db), { page, limit, search })
  return {
    items: result.items,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit)
    }
  }
})
