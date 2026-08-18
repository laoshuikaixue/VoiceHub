import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { paymentSettings } from '~/drizzle/schema'
import { requirePaymentAdmin } from '~~/server/utils/paymentAuth'
import { getPaymentSettings } from '~~/server/services/paymentService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'

export default defineEventHandler(async event => {
  requirePaymentAdmin(event)
  const current = await getPaymentSettings()
  const body = await readBody(event)
  const values = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    currency: typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : current.currency,
    productNamePrefix: typeof body.productNamePrefix === 'string' ? body.productNamePrefix.slice(0, 100) : current.productNamePrefix,
    productNameSuffix: typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : current.productNameSuffix,
    minAmountCents: Number.isInteger(body.minAmountCents) ? body.minAmountCents : current.minAmountCents,
    maxAmountCents: body.maxAmountCents == null ? null : Number(body.maxAmountCents),
    dailyLimitCents: body.dailyLimitCents == null ? null : Number(body.dailyLimitCents),
    balanceRechargeMultiplier: Number.isFinite(Number(body.balanceRechargeMultiplier)) ? String(body.balanceRechargeMultiplier) : current.balanceRechargeMultiplier,
    subscriptionUsdToCnyRate: Number.isFinite(Number(body.subscriptionUsdToCnyRate)) ? String(body.subscriptionUsdToCnyRate) : current.subscriptionUsdToCnyRate,
    rechargeFeeRate: Number.isFinite(Number(body.rechargeFeeRate)) ? String(body.rechargeFeeRate) : current.rechargeFeeRate,
    orderTimeoutMinutes: Number.isInteger(body.orderTimeoutMinutes) ? body.orderTimeoutMinutes : current.orderTimeoutMinutes,
    maxPendingOrders: Number.isInteger(body.maxPendingOrders) ? body.maxPendingOrders : current.maxPendingOrders,
    loadBalanceStrategy: ['round-robin', 'least-amount'].includes(body.loadBalanceStrategy) ? body.loadBalanceStrategy : current.loadBalanceStrategy,
    helpText: typeof body.helpText === 'string' ? body.helpText : null,
    helpImageUrl: typeof body.helpImageUrl === 'string' ? body.helpImageUrl : null,
    cancelLimitEnabled: typeof body.cancelLimitEnabled === 'boolean' ? body.cancelLimitEnabled : current.cancelLimitEnabled,
    cancelWindowMinutes: Number.isInteger(body.cancelWindowMinutes) ? body.cancelWindowMinutes : current.cancelWindowMinutes,
    cancelWindowUnit: ['minute', 'hour', 'day'].includes(body.cancelWindowUnit) ? body.cancelWindowUnit : (current.cancelWindowUnit || 'minute'),
    cancelWindowMode: ['rolling', 'fixed'].includes(body.cancelWindowMode) ? body.cancelWindowMode : (current.cancelWindowMode || 'rolling'),
    cancelMaxCount: Number.isInteger(body.cancelMaxCount) ? body.cancelMaxCount : current.cancelMaxCount,
    alipayForceQrCode: typeof body.alipayForceQrCode === 'boolean' ? body.alipayForceQrCode : current.alipayForceQrCode,
    alipayMobileDeepLink: typeof body.alipayMobileDeepLink === 'boolean' ? body.alipayMobileDeepLink : current.alipayMobileDeepLink,
    updatedAt: getServerDate()
  }
  if (values.minAmountCents < 1 || values.orderTimeoutMinutes < 1 || values.maxPendingOrders < 1 || values.cancelWindowMinutes < 1 || values.cancelMaxCount < 1 || Number(values.balanceRechargeMultiplier) <= 0 || Number(values.subscriptionUsdToCnyRate) < 0 || Number(values.rechargeFeeRate) < 0 || Number(values.rechargeFeeRate) > 100 || (values.maxAmountCents && values.maxAmountCents < values.minAmountCents)) {
    throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_CONFIG_INVALID, '支付配置参数无效')
  }
  const [updated] = await db.update(paymentSettings).set(values).where(eq(paymentSettings.id, current.id)).returning()
  return updated
})
