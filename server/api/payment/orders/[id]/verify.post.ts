import { toPublicPaymentOrder, verifyPaymentOrder } from '~~/server/services/paymentService'
import { requirePaymentUser } from '~~/server/utils/paymentAuth'

export default defineEventHandler(async event => {
  const user = requirePaymentUser(event)
  return toPublicPaymentOrder(await verifyPaymentOrder(getRouterParam(event, 'id') || '', user.id))
})
