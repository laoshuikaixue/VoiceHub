import { eq } from 'drizzle-orm'; import { db } from '~/drizzle/db'; import { paymentPlans } from '~/drizzle/schema'; import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
export default defineEventHandler(async event => { requirePaymentAdmin(event); await db.delete(paymentPlans).where(eq(paymentPlans.id, Number(getRouterParam(event, 'id')))); return { success: true } })
