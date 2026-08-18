import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { getPaymentSettings } from '~~/server/services/paymentService'
import { PAYMENT_METHODS } from '~~/server/config/payment'

export default defineEventHandler(async () => {
  const settings = await getPaymentSettings()
  const providers = await db.select({ supportedMethods: paymentProviderInstances.supportedMethods })
    .from(paymentProviderInstances).where(eq(paymentProviderInstances.enabled, true))
  const available = new Set(providers.flatMap(item => item.supportedMethods))
  return {
    enabled: settings.enabled,
    currency: settings.currency,
    methods: settings.visibleMethods.filter(method => available.has(method)),
    helpText: settings.helpText,
    helpImageUrl: settings.helpImageUrl
  }
})
