import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'; import { verifyPaymentOrder } from '~~/server/services/paymentService'
export default defineEventHandler(async event => { requirePaymentAdmin(event); return verifyPaymentOrder(getRouterParam(event, 'id') || '') })
