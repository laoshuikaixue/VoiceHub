import { desc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentOrders } from '~/drizzle/schema'
import { requirePaymentUser } from '~~/server/utils/paymentAuth'
import { expirePaymentOrders, toPublicPaymentOrder } from '~~/server/services/paymentService'

export default defineEventHandler(async event => {
  const user = requirePaymentUser(event)
  await expirePaymentOrders()
  const orders = await db.select().from(paymentOrders).where(eq(paymentOrders.userId, user.id)).orderBy(desc(paymentOrders.createdAt)).limit(100)
  return orders.map(toPublicPaymentOrder)
})
