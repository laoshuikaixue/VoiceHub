import { getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { createSongQuotaDrizzleAdapter } from '~~/server/services/songQuotaDrizzleAdapter'
import {
  buildPublicSongQuotaTransaction,
  listSongQuotaTransactions
} from '~~/server/services/songQuotaService'
import { createApiError } from '~~/server/utils/apiError'

const parsePositiveInteger = (value: unknown, fallback: number, maximum: number) => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED', '需要登录才能查看额度流水')
  }

  const query = getQuery(event)
  const result = await listSongQuotaTransactions(createSongQuotaDrizzleAdapter(db), {
    userId: user.id,
    page: parsePositiveInteger(query.page, 1, 1000000),
    limit: parsePositiveInteger(query.limit, 20, 100)
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
