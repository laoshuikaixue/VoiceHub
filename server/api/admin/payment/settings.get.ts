import { getPaymentSettings } from '~~/server/services/paymentService'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event)
  return getPaymentSettings()
})
