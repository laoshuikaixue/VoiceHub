import { createPaymentOrder } from '~~/server/services/paymentService'
import { isPaymentMethodIdentifier } from '~~/server/config/payment'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const planId = Number(body?.planId)
  const quantity = Number(body?.quantity ?? 1)
  if (!Number.isInteger(planId) || planId <= 0 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 || !isPaymentMethodIdentifier(body?.method)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '套餐或支付方式无效')
  }
  return createPaymentOrder(event, planId, body.method, Boolean(body.mobile), quantity)
})
