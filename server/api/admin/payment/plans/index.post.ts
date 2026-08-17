import { db } from '~/drizzle/db'
import { paymentPlans } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
export default defineEventHandler(async event => {
  requirePaymentAdmin(event); const body = await readBody(event)
  if (!body?.name || !Number.isInteger(body.priceCents) || body.priceCents < 1 || !Number.isInteger(body.cardCount) || body.cardCount < 1) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '套餐参数无效')
  const [created] = await db.insert(paymentPlans).values({ name: String(body.name).slice(0, 100), description: String(body.description || ''), priceCents: body.priceCents, originalPriceCents: body.originalPriceCents || null, currency: body.currency || 'CNY', cardCount: body.cardCount, features: Array.isArray(body.features) ? body.features.map(String) : [], forSale: body.forSale !== false, sortOrder: Number(body.sortOrder || 0) }).returning()
  return created
})
