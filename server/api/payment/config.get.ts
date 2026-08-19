import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { getPaymentSettings } from '~~/server/services/paymentService'
import { getPaymentProviderAllowedMethods, PAYMENT_METHODS, normalizeEasyPayCustomMethods } from '~~/server/config/payment'
import { decryptPaymentConfig } from '~~/server/utils/paymentCrypto'

export default defineEventHandler(async () => {
  const settings = await getPaymentSettings()
  const providers = await db.select({ supportedMethods: paymentProviderInstances.supportedMethods, providerKey: paymentProviderInstances.providerKey, configEncrypted: paymentProviderInstances.configEncrypted })
    .from(paymentProviderInstances).where(eq(paymentProviderInstances.enabled, true))
  const available = new Set<string>()
  const methodLabels: Record<string, string> = {}
  for (const provider of providers) {
    try {
      const config = decryptPaymentConfig(provider.configEncrypted)
      const allowedMethods = new Set(getPaymentProviderAllowedMethods(provider.providerKey, config))
      for (const method of provider.supportedMethods) {
        if (allowedMethods.has(method)) available.add(method)
      }
      if (provider.providerKey !== 'easypay') continue
      for (const item of normalizeEasyPayCustomMethods(config.customMethods) || []) {
        if (available.has(item.type)) methodLabels[item.type] = item.label
      }
    } catch (error) {
      console.error('[payment config] 读取支付服务商配置失败', { providerKey: provider.providerKey, error: String(error) })
    }
  }
  return {
    enabled: settings.enabled,
    currency: settings.currency,
    methods: [...PAYMENT_METHODS.filter(method => available.has(method)), ...[...available].filter(method => !PAYMENT_METHODS.includes(method as any))],
    methodLabels,
    helpText: settings.helpText,
    helpImageUrl: settings.helpImageUrl
  }
})
