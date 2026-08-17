import { and, count, desc, gte, inArray, sql, sum } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentOrders } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event); const days = Math.min(365, Math.max(1, Number(getQuery(event).days) || 30)); const now = getServerTimestamp(); const since = getServerDate(); since.setTime(now - days * 86400000); const todaySince = getServerDate(); todaySince.setHours(0, 0, 0, 0)
  const completed = ['COMPLETED', 'REFUND_REQUESTED', 'REFUNDING', 'REFUNDED'] as const
  const periodWhere = and(gte(paymentOrders.createdAt, since), inArray(paymentOrders.status, [...completed]))
  const [summary, todaySummary] = await Promise.all([
    db.select({ orderCount: count(), revenueCents: sum(paymentOrders.payAmountCents), refundCents: sum(paymentOrders.refundAmountCents) }).from(paymentOrders).where(periodWhere),
    db.select({ orderCount: count(), revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(and(gte(paymentOrders.createdAt, todaySince), inArray(paymentOrders.status, [...completed])))
  ])
  const [period] = summary; const [today] = todaySummary
  const [byMethod, dailyRows, avgRows, topRows] = await Promise.all([
    db.select({ method: paymentOrders.paymentMethod, currency: paymentOrders.currency, orders: count(), revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(periodWhere).groupBy(paymentOrders.paymentMethod, paymentOrders.currency),
    db.select({ date: sql<string>`to_char(${paymentOrders.paidAt}, 'YYYY-MM-DD')`, currency: paymentOrders.currency, orders: count(), revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(and(gte(paymentOrders.paidAt, since), inArray(paymentOrders.status, [...completed]))).groupBy(sql`to_char(${paymentOrders.paidAt}, 'YYYY-MM-DD')`, paymentOrders.currency).orderBy(sql`to_char(${paymentOrders.paidAt}, 'YYYY-MM-DD')`),
    db.select({ currency: paymentOrders.currency, orders: count(), revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(periodWhere).groupBy(paymentOrders.currency),
    db.select({ userId: paymentOrders.userId, userName: paymentOrders.userName, userEmail: paymentOrders.userEmail, currency: paymentOrders.currency, revenueCents: sum(paymentOrders.payAmountCents) }).from(paymentOrders).where(periodWhere).groupBy(paymentOrders.userId, paymentOrders.userName, paymentOrders.userEmail, paymentOrders.currency).orderBy(desc(sum(paymentOrders.payAmountCents))).limit(10)
  ])
  const dailyMap = new Map<string, { date: string; orders: number; amount: Record<string, number> }>()
  for (const row of dailyRows) { const item = dailyMap.get(row.date) || { date: row.date, orders: 0, amount: {} }; item.orders += Number(row.orders || 0); item.amount[row.currency] = Number(row.revenueCents || 0) / 100; dailyMap.set(row.date, item) }
  const todayAmount = Number(today?.revenueCents || 0) / 100; const totalAmount = Number(period?.revenueCents || 0) / 100
  const avgAmount = Object.fromEntries(avgRows.map(row => [row.currency, Number(row.revenueCents || 0) / Math.max(1, Number(row.orders || 1)) / 100]))
  const paymentMethods = byMethod.map(row => ({ type: row.method, currency: row.currency, count: Number(row.orders || 0), amount: Number(row.revenueCents || 0) / 100 }))
  const topUsers = topRows.map(row => ({ userId: row.userId, name: row.userName || row.userEmail || `用户 #${row.userId}`, email: row.userEmail, currency: row.currency, amount: Number(row.revenueCents || 0) / 100 }))
  return { days, orderCount: Number(period?.orderCount || 0), revenueCents: Number(period?.revenueCents || 0), refundCents: Number(period?.refundCents || 0), todayCount: Number(today?.orderCount || 0), todayAmount, totalAmount, avgAmount, byMethod, paymentMethods, topUsers, daily: [...dailyMap.values()] }
})
