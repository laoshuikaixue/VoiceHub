import { and, gte, inArray } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentOrders } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'

const completedStatuses = ['COMPLETED', 'REFUND_REQUESTED', 'REFUNDING', 'REFUNDED'] as const
const toNumber = (value: unknown) => Number(value || 0) || 0
const paymentDate = (order: any) => order.paidAt || order.completedAt || order.createdAt

export default defineEventHandler(async event => {
  requirePaymentAdmin(event)
  const days = Math.min(365, Math.max(1, Number(getQuery(event).days) || 30))
  const since = getServerDate()
  since.setTime(getServerTimestamp() - days * 86400000)
  const today = getServerDate()
  today.setHours(0, 0, 0, 0)
  const orders = await db.select({ id: paymentOrders.id, userId: paymentOrders.userId, userName: paymentOrders.userName, userEmail: paymentOrders.userEmail, paymentMethod: paymentOrders.paymentMethod, currency: paymentOrders.currency, payAmountCents: paymentOrders.payAmountCents, refundAmountCents: paymentOrders.refundAmountCents, paidAt: paymentOrders.paidAt, completedAt: paymentOrders.completedAt, createdAt: paymentOrders.createdAt }).from(paymentOrders).where(and(gte(paymentOrders.createdAt, since), inArray(paymentOrders.status, [...completedStatuses])))
  const revenueByCurrency = new Map(); const methods = new Map(); const users = new Map(); const daily = new Map(); let todayCount = 0; let todayCents = 0
  for (const order of orders) {
    const currency = order.currency || 'CNY'; const cents = toNumber(order.payAmountCents); const refundCents = toNumber(order.refundAmountCents)
    const summary = revenueByCurrency.get(currency) || { count: 0, cents: 0, refunds: 0 }; summary.count += 1; summary.cents += cents; summary.refunds += refundCents; revenueByCurrency.set(currency, summary)
    const methodKey = `${order.paymentMethod}:${currency}`; const method = methods.get(methodKey) || { type: order.paymentMethod, currency, count: 0, cents: 0 }; method.count += 1; method.cents += cents; methods.set(methodKey, method)
    const userKey = `${order.userId}:${currency}`; const user = users.get(userKey) || { userId: order.userId, name: order.userName, email: order.userEmail, currency, cents: 0 }; user.cents += cents; users.set(userKey, user)
    const date = paymentDate(order); if (date >= today) { todayCount += 1; todayCents += cents }
    const dayKey = date.toISOString().slice(0, 10); const day = daily.get(dayKey) || { date: dayKey, orders: 0, amount: {} }; day.orders += 1; day.amount[currency] = toNumber(day.amount[currency]) + cents / 100; daily.set(dayKey, day)
  }
  const avgAmount = Object.fromEntries([...revenueByCurrency].map(([currency, value]) => [currency, value.count ? value.cents / value.count / 100 : 0])); const totalCents = [...revenueByCurrency.values()].reduce((total, value) => total + value.cents, 0); const refundCents = [...revenueByCurrency.values()].reduce((total, value) => total + value.refunds, 0)
  return { days, orderCount: orders.length, revenueCents: totalCents, refundCents, todayCount, todayAmount: todayCents / 100, totalAmount: totalCents / 100, avgAmount, byMethod: [...methods.values()].map(item => ({ method: item.type, currency: item.currency, orders: item.count, revenueCents: item.cents })), paymentMethods: [...methods.values()].map(item => ({ type: item.type, currency: item.currency, count: item.count, amount: item.cents / 100 })), topUsers: [...users.values()].sort((left, right) => right.cents - left.cents).slice(0, 10).map(item => ({ ...item, amount: item.cents / 100 })), daily: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)) }
})
