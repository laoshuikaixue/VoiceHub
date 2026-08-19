import { desc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodes, paymentAuditLogs, paymentOrderCards, paymentOrders } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event); const id = getRouterParam(event, 'id') || ''
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  const auditLogs = await db.select().from(paymentAuditLogs).where(eq(paymentAuditLogs.orderId, id)).orderBy(desc(paymentAuditLogs.createdAt), desc(paymentAuditLogs.id))
  const cards = await db.select({ id: cardCodes.id, code: cardCodes.code, status: cardCodes.status }).from(paymentOrderCards).innerJoin(cardCodes, eq(cardCodes.id, paymentOrderCards.cardCodeId)).where(eq(paymentOrderCards.orderId, id))
  const snapshot = order.providerSnapshot || {}
  const safeOrder = { ...order, providerSnapshot: Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'configEncrypted')) }
  return { order: safeOrder, auditLogs, cards }
})
