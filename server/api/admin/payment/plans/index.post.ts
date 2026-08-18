import { db } from '~/drizzle/db'
import { paymentPlans } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
export default defineEventHandler(async event => {
  requirePaymentAdmin(event); const body = await readBody(event)
  const currency = String(body?.currency || 'CNY').trim().toUpperCase(); const validityUnit = String(body?.validityUnit || 'day'); const validityValue = Number(body?.validityValue ?? 30)
  if (!body?.name || !Number.isInteger(body.priceCents) || body.priceCents < 1 || (body.originalPriceCents !== null && body.originalPriceCents !== undefined && (!Number.isInteger(body.originalPriceCents) || body.originalPriceCents < 0)) || !Number.isInteger(body.cardCount) || body.cardCount < 1 || !Number.isInteger(validityValue) || validityValue < 1 || !/^[A-Z]{3}$/.test(currency) || !['day', 'month', 'year'].includes(validityUnit)) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '套餐参数无效')
  const [created] = await db.insert(paymentPlans).values({ name: String(body.name).trim().slice(0, 100), description: String(body.description || ''), priceCents: body.priceCents, originalPriceCents: body.originalPriceCents ?? null, currency, cardCount: body.cardCount, validityValue, validityUnit, features: Array.isArray(body.features) ? body.features.map(String).slice(0, 20) : [], forSale: body.forSale !== false, sortOrder: Number(body.sortOrder || 0) }).returning()
  return created
})
