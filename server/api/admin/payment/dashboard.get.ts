import { and, count, gte, inArray, sql, sum } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentOrders } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { getServerTimestamp } from '~~/server/utils/serverTime'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event); const days = Math.min(365, Math.max(1, Number(getQuery(event).days) || 30)); const since = new Date(getServerTimestamp() - days * 86400000)
  const completed = ['COMPLETED', 'REFUND_REQUESTED', 'REFUNDING', 'REFUNDED'] as const
  const [summary] = await db.select({ orderCount: count(), revenueCents: sum(paymentOrders.payAmountCents), refundCents: sum(paymentOrders.refundAmountCents) }).from(paymentOrders).where(and(gte(paymentOrders.createdAt, since), inArray(paymentOrders.status, [...completed])))
  const byMethod = await db.select({ method: paymentOrders.paymentMethod, orders: count(), revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(and(gte(paymentOrders.createdAt, since), inArray(paymentOrders.status, [...completed]))).groupBy(paymentOrders.paymentMethod)
  const daily = await db.select({ date: sql<string>`to_char(${paymentOrders.paidAt}, 'YYYY-MM-DD')`, orders: count(), revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(and(gte(paymentOrders.paidAt, since), inArray(paymentOrders.status, [...completed]))).groupBy(sql`to_char(${paymentOrders.paidAt}, 'YYYY-MM-DD')`).orderBy(sql`to_char(${paymentOrders.paidAt}, 'YYYY-MM-DD')`)
  return { days, orderCount: Number(summary?.orderCount || 0), revenueCents: Number(summary?.revenueCents || 0), refundCents: Number(summary?.refundCents || 0), byMethod, daily }
})
