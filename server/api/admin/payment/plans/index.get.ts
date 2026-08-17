import { asc } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentPlans } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
export default defineEventHandler(async event => { requirePaymentAdmin(event); return db.select().from(paymentPlans).orderBy(asc(paymentPlans.sortOrder)) })
