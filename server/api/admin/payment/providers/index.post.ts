import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { encryptPaymentConfig, maskPaymentConfig } from '~~/server/utils/paymentCrypto'
import { isPaymentProviderKey, PAYMENT_PROVIDER_CONFIG_FIELDS, PAYMENT_PROVIDER_METHODS } from '~~/server/config/payment'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event)
  const body = await readBody(event)
  if (!isPaymentProviderKey(body?.providerKey) || !body?.name || typeof body.config !== 'object') {
    throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_PROVIDER_INVALID, '支付服务商参数无效')
  }
  const missing = (PAYMENT_PROVIDER_CONFIG_FIELDS[body.providerKey] || []).filter(key => !String(body.config[key] || '').trim())
  if (missing.length) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, '支付服务商配置不完整', { params: [missing.join(', ')] })
  const allowedMethods = PAYMENT_PROVIDER_METHODS[body.providerKey] || []
  const supportedMethods = Array.isArray(body.supportedMethods) ? body.supportedMethods.filter((item: string) => allowedMethods.includes(item)) : allowedMethods
  const [created] = await db.insert(paymentProviderInstances).values({
    providerKey: body.providerKey, name: String(body.name).slice(0, 100),
    configEncrypted: encryptPaymentConfig(body.config), supportedMethods,
    enabled: body.enabled !== false, paymentMode: String(body.paymentMode || ''),
    sortOrder: Number(body.sortOrder || 0), limits: body.limits || {},
    refundEnabled: Boolean(body.refundEnabled), allowUserRefund: Boolean(body.allowUserRefund)
  }).returning()
  if (!created) throw new Error('支付服务商创建失败')
  const { configEncrypted, ...safe } = created
  return { ...safe, config: maskPaymentConfig(body.config) }
})
