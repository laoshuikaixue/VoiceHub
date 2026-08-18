import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentOrders } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { expirePaymentOrders, toAdminPaymentOrder } from '~~/server/services/paymentService'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event); await expirePaymentOrders()
  const query = getQuery(event); const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const filters = []
  if (query.status) filters.push(eq(paymentOrders.status, String(query.status) as any))
  if (query.method) filters.push(eq(paymentOrders.paymentMethod, String(query.method)))
  if (query.keyword) filters.push(or(ilike(paymentOrders.outTradeNo, `%${query.keyword}%`), ilike(paymentOrders.userName, `%${query.keyword}%`))!)
  const where = filters.length ? and(...filters) : undefined
  const [total] = await db.select({ value: count() }).from(paymentOrders).where(where)
  const items = await db.select().from(paymentOrders).where(where).orderBy(desc(paymentOrders.createdAt)).limit(pageSize).offset((page - 1) * pageSize)
  return { items: items.map(toAdminPaymentOrder), total: Number(total?.value || 0), page, pageSize }
})
