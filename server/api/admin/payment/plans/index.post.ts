import { db } from '~/drizzle/db'
import { paymentPlans } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
export default defineEventHandler(async event => {
  requirePaymentAdmin(event); const body = await readBody(event)
  const currency = String(body?.currency || 'CNY').trim().toUpperCase(); const validityEmpty = body?.validityValue === null || body?.validityValue === undefined || body?.validityValue === ''; const validityValue = validityEmpty ? null : Number(body.validityValue); const validityUnit = validityEmpty ? null : String(body?.validityUnit || 'day')
  if (!body?.name || !Number.isSafeInteger(body.priceCents) || body.priceCents < 1 || (body.originalPriceCents !== null && body.originalPriceCents !== undefined && (!Number.isSafeInteger(body.originalPriceCents) || body.originalPriceCents < 0)) || !Number.isSafeInteger(body.cardCount) || body.cardCount < 1 || (!validityEmpty && (!Number.isSafeInteger(validityValue) || validityValue < 1 || !['day', 'month', 'year'].includes(validityUnit))) || !/^[A-Z]{3}$/.test(currency)) throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '套餐参数无效')
  const [created] = await db.insert(paymentPlans).values({ name: String(body.name).trim().slice(0, 100), description: String(body.description || ''), priceCents: body.priceCents, originalPriceCents: body.originalPriceCents ?? null, currency, cardCount: body.cardCount, validityValue, validityUnit, features: Array.isArray(body.features) ? body.features.map(String).slice(0, 20) : [], forSale: body.forSale !== false, sortOrder: Number(body.sortOrder || 0) }).returning()
  return created
})
