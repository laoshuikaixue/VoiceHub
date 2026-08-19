import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { decryptPaymentConfig, encryptPaymentConfig, maskPaymentConfig } from '~~/server/utils/paymentCrypto'
import { getPaymentProviderConfigError, PAYMENT_PROVIDER_CONFIG_FIELDS, PAYMENT_PROVIDER_METHODS } from '~~/server/config/payment'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const [current] = await db.select().from(paymentProviderInstances).where(eq(paymentProviderInstances.id, id)).limit(1)
  if (!current) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, '支付服务商不存在')
  const body = await readBody(event)
  const oldConfig = decryptPaymentConfig(current.configEncrypted)
  const config = Object.fromEntries(Object.entries({ ...oldConfig, ...(body.config || {}) }).map(([key, value]) => [key, value === '********' ? oldConfig[key] : value]))
  const missing = (PAYMENT_PROVIDER_CONFIG_FIELDS[current.providerKey] || []).filter(key => !String(config[key] || '').trim())
  if (missing.length) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, '支付服务商配置不完整', { params: [missing.join(', ')] })
  const configError = getPaymentProviderConfigError(current.providerKey, config)
  if (configError) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, configError)
  const allowedMethods = PAYMENT_PROVIDER_METHODS[current.providerKey] || []
  const refundEnabled = typeof body.refundEnabled === 'boolean' ? body.refundEnabled : current.refundEnabled
  const allowUserRefund = refundEnabled && (typeof body.allowUserRefund === 'boolean' ? body.allowUserRefund : current.allowUserRefund)
  const [updated] = await db.update(paymentProviderInstances).set({
    name: typeof body.name === 'string' ? body.name.slice(0, 100) : current.name,
    configEncrypted: encryptPaymentConfig(config),
    supportedMethods: Array.isArray(body.supportedMethods) ? body.supportedMethods.filter((item: string) => allowedMethods.includes(item)) : current.supportedMethods,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    paymentMode: typeof body.paymentMode === 'string' ? body.paymentMode : current.paymentMode,
    sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : current.sortOrder,
    limits: body.limits && typeof body.limits === 'object' ? body.limits : current.limits,
    refundEnabled,
    allowUserRefund,
    updatedAt: getServerDate()
  }).where(eq(paymentProviderInstances.id, id)).returning()
  if (!updated) throw new Error('支付服务商更新失败')
  const { configEncrypted, ...safe } = updated
  return { ...safe, config: maskPaymentConfig(config) }
})
