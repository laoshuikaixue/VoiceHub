import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentProviderInstances } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { decryptPaymentConfig, encryptPaymentConfig, maskPaymentConfig } from '~~/server/utils/paymentCrypto'
import { getPaymentProviderAllowedMethods, getPaymentProviderConfigError, isPaymentMode, normalizeEasyPayCustomMethods, PAYMENT_PROVIDER_CONFIG_FIELDS } from '~~/server/config/payment'
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
  const patchConfig = body?.config && typeof body.config === 'object' && !Array.isArray(body.config) ? body.config : {}
  const config = Object.fromEntries(Object.entries({ ...oldConfig, ...patchConfig }).map(([key, value]) => [key, value === '********' ? oldConfig[key] : value]))
  if (current.providerKey === 'easypay' && Object.prototype.hasOwnProperty.call(patchConfig, 'customMethods')) config.customMethods = normalizeEasyPayCustomMethods(patchConfig.customMethods)
  const missing = (PAYMENT_PROVIDER_CONFIG_FIELDS[current.providerKey] || []).filter(key => !String(config[key] || '').trim())
  if (missing.length) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, '支付服务商配置不完整', { params: [missing.join(', ')] })
  const configError = getPaymentProviderConfigError(current.providerKey, config)
  if (configError) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, configError)
  const paymentMode = typeof body.paymentMode === 'string' ? body.paymentMode : current.paymentMode
  if (!isPaymentMode(current.providerKey, paymentMode)) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, '支付模式无效')
  const allowedMethods = getPaymentProviderAllowedMethods(current.providerKey, config)
  const supportedMethods = Array.isArray(body.supportedMethods) ? body.supportedMethods.filter((item: string) => allowedMethods.includes(item)) : current.supportedMethods.filter(item => allowedMethods.includes(item))
  if (!supportedMethods.length) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, '至少启用一种支付方式')
  const refundEnabled = typeof body.refundEnabled === 'boolean' ? body.refundEnabled : current.refundEnabled
  const allowUserRefund = refundEnabled && (typeof body.allowUserRefund === 'boolean' ? body.allowUserRefund : current.allowUserRefund)
  const [updated] = await db.update(paymentProviderInstances).set({
    name: typeof body.name === 'string' ? body.name.slice(0, 100) : current.name,
    configEncrypted: encryptPaymentConfig(config),
    supportedMethods,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    paymentMode,
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
