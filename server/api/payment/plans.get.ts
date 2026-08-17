import { and, asc, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentPlans } from '~/drizzle/schema'
import { getPaymentSettings } from '~~/server/services/paymentService'

export default defineEventHandler(async () => {
  const settings = await getPaymentSettings()
  if (!settings.enabled) return []
  return db.select().from(paymentPlans).where(and(eq(paymentPlans.forSale, true), eq(paymentPlans.currency, settings.currency))).orderBy(asc(paymentPlans.sortOrder))
})
