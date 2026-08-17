import { cancelPaymentOrder } from '~~/server/services/paymentService'
import { requirePaymentUser } from '~~/server/utils/paymentAuth'

export default defineEventHandler(async event => {
  const user = requirePaymentUser(event)
  await cancelPaymentOrder(getRouterParam(event, 'id') || '', user.id)
  return { success: true }
})
