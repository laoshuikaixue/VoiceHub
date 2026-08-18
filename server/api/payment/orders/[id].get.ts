import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodes, paymentOrderCards, paymentOrders } from '~/drizzle/schema'
import { requirePaymentUser } from '~~/server/utils/paymentAuth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { expirePaymentOrders, toPublicPaymentOrder } from '~~/server/services/paymentService'

export default defineEventHandler(async event => {
  const user = requirePaymentUser(event)
  const id = getRouterParam(event, 'id') || ''
  await expirePaymentOrders()
  const [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.id, id), eq(paymentOrders.userId, user.id))).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  const cards = order.status === 'COMPLETED'
    ? await db.select({ id: cardCodes.id, code: cardCodes.code, status: cardCodes.status, redeemedAt: cardCodes.redeemedAt })
      .from(paymentOrderCards).innerJoin(cardCodes, eq(cardCodes.id, paymentOrderCards.cardCodeId))
      .where(eq(paymentOrderCards.orderId, order.id))
    : []
  return { order: toPublicPaymentOrder(order), cards }
})
