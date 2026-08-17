import { and, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentOrders, paymentProviderInstances } from '~/drizzle/schema'
import { requirePaymentUser } from '~~/server/utils/paymentAuth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'
import { addPaymentAudit } from '~~/server/services/paymentService'

export default defineEventHandler(async event => {
  const user = requirePaymentUser(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody(event)
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
  const [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.id, id), eq(paymentOrders.userId, user.id))).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  if (order.status !== 'COMPLETED') throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_ORDER_STATE_INVALID, '当前订单不可申请退款')
  const [provider] = order.providerInstanceId
    ? await db.select({ allowed: paymentProviderInstances.allowUserRefund }).from(paymentProviderInstances).where(eq(paymentProviderInstances.id, order.providerInstanceId)).limit(1)
    : []
  if (!provider?.allowed) throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_REFUND_UNSUPPORTED, '该支付通道不支持用户申请退款')
  await db.update(paymentOrders).set({ status: 'REFUND_REQUESTED', refundReason: reason || '用户申请退款', refundRequestedAt: getServerDate(), updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
  await addPaymentAudit(order.id, 'REFUND_REQUESTED', { reason }, `user:${user.id}`)
  return { success: true }
})
