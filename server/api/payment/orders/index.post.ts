import { createPaymentOrder } from '~~/server/services/paymentService'
import { isPaymentMethod } from '~~/server/config/payment'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const planId = Number(body?.planId)
  if (!Number.isInteger(planId) || planId <= 0 || !isPaymentMethod(body?.method)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '套餐或支付方式无效')
  }
  return createPaymentOrder(event, planId, body.method, Boolean(body.mobile))
})
