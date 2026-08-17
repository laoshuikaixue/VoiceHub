import { randomBytes } from 'node:crypto'
import { and, asc, count, desc, eq, gte, inArray, lte, sum } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import {
  cardCodes,
  paymentAuditLogs,
  paymentOrderCards,
  paymentOrders,
  paymentPlans,
  paymentProviderInstances,
  paymentSettings
} from '~/drizzle/schema'
import { decryptPaymentConfig } from '~~/server/utils/paymentCrypto'
import { createPaymentProvider, type PaymentNotification } from './paymentProviders'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'
import { getClientIP } from '~~/server/utils/ip-utils'
import { getHeader, getRequestURL, type H3Event } from 'h3'

const PAID_STATUSES = ['PAID', 'COMPLETED', 'REFUND_REQUESTED', 'REFUNDING', 'REFUNDED'] as const

export const toPublicPaymentOrder = (order: typeof paymentOrders.$inferSelect) => {
  const snapshot = order.providerSnapshot || {}
  const { providerSnapshot: _providerSnapshot, ...safe } = order
  return { ...safe, providerData: snapshot.checkout || undefined }
}

export const getPaymentSettings = async () => {
  const existing = await db.select().from(paymentSettings).limit(1)
  if (existing[0]) return existing[0]
  const inserted = await db.insert(paymentSettings).values({}).returning()
  if (!inserted[0]) throw new Error('支付设置初始化失败')
  return inserted[0]
}

export const addPaymentAudit = async (
  orderId: string,
  action: string,
  detail: Record<string, unknown> = {},
  operator = 'system'
) => {
  await db.insert(paymentAuditLogs).values({ orderId, action, detail, operator })
}

const startOfToday = () => {
  const date = getServerDate()
  date.setHours(0, 0, 0, 0)
  return date
}

const selectProvider = async (method: string, amountCents: number, strategy: string) => {
  const providers = await db.select().from(paymentProviderInstances)
    .where(eq(paymentProviderInstances.enabled, true)).orderBy(asc(paymentProviderInstances.sortOrder))
  const eligible = []
  for (const provider of providers) {
    if (!provider.supportedMethods.includes(method)) continue
    const min = Number(provider.limits?.minAmountCents || 0)
    const max = Number(provider.limits?.maxAmountCents || 0)
    if ((min && amountCents < min) || (max && amountCents > max)) continue
    const dailyLimit = Number(provider.limits?.dailyLimitCents || 0)
    const [daily] = await db.select({ total: sum(paymentOrders.payAmountCents) }).from(paymentOrders)
      .where(and(eq(paymentOrders.providerInstanceId, provider.id), gte(paymentOrders.paidAt, startOfToday()), inArray(paymentOrders.status, [...PAID_STATUSES])))
    const dailyAmount = Number(daily?.total || 0)
    if (dailyLimit && dailyAmount + amountCents > dailyLimit) continue
    eligible.push({ provider, dailyAmount })
  }
  if (!eligible.length) throw createApiError(503, SERVER_ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, '暂无可用支付通道')
  if (strategy === 'least-amount') return eligible.sort((a, b) => a.dailyAmount - b.dailyAmount)[0]!.provider
  const [recent] = await db.select({ providerInstanceId: paymentOrders.providerInstanceId }).from(paymentOrders)
    .where(eq(paymentOrders.paymentMethod, method)).orderBy(desc(paymentOrders.createdAt)).limit(1)
  const index = recent?.providerInstanceId ? eligible.findIndex(item => item.provider.id === recent.providerInstanceId) : -1
  return eligible[(index + 1) % eligible.length]!.provider
}

const makeTradeNo = () => `VH${getServerTimestamp()}${randomBytes(5).toString('hex').toUpperCase()}`
const makeCardCode = () => `PAY-${randomBytes(10).toString('hex').toUpperCase()}`

export const createPaymentOrder = async (event: H3Event, planId: number, method: string, mobile: boolean) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.PAYMENT_AUTH_REQUIRED, '请先登录后购买')
  const settings = await getPaymentSettings()
  if (!settings.enabled) throw createApiError(403, SERVER_ERROR_CODES.PAYMENT_DISABLED, '支付系统未启用')
  if (!settings.visibleMethods.includes(method)) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_METHOD_INVALID, '支付方式不可用')
  const [plan] = await db.select().from(paymentPlans).where(and(eq(paymentPlans.id, planId), eq(paymentPlans.forSale, true))).limit(1)
  if (!plan) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_PLAN_NOT_FOUND, '套餐不存在或已下架')
  if (plan.priceCents < settings.minAmountCents || (settings.maxAmountCents && plan.priceCents > settings.maxAmountCents)) {
    throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_AMOUNT_INVALID, '套餐金额超出允许范围')
  }
  const [pending] = await db.select({ value: count() }).from(paymentOrders)
    .where(and(eq(paymentOrders.userId, user.id), eq(paymentOrders.status, 'PENDING'), gte(paymentOrders.expiresAt, getServerDate())))
  if (Number(pending?.value || 0) >= settings.maxPendingOrders) throw createApiError(429, SERVER_ERROR_CODES.PAYMENT_PENDING_LIMIT, '待支付订单数量已达上限')
  if (settings.dailyLimitCents) {
    const [daily] = await db.select({ total: sum(paymentOrders.payAmountCents) }).from(paymentOrders)
      .where(and(eq(paymentOrders.userId, user.id), gte(paymentOrders.paidAt, startOfToday()), inArray(paymentOrders.status, [...PAID_STATUSES])))
    if (Number(daily?.total || 0) + plan.priceCents > settings.dailyLimitCents) throw createApiError(429, SERVER_ERROR_CODES.PAYMENT_DAILY_LIMIT, '今日购买金额已达上限')
  }
  const providerRow = await selectProvider(method, plan.priceCents, settings.loadBalanceStrategy)
  const config = decryptPaymentConfig(providerRow.configEncrypted)
  const provider = createPaymentProvider(providerRow.providerKey, { ...config, paymentMode: providerRow.paymentMode })
  const outTradeNo = makeTradeNo()
  const expiresAt = getServerDate()
  expiresAt.setTime(expiresAt.getTime() + settings.orderTimeoutMinutes * 60000)
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const [order] = await db.insert(paymentOrders).values({
    outTradeNo, userId: user.id, userName: user.name || user.username, userEmail: user.email || null,
    planId: plan.id, planName: plan.name, cardCount: plan.cardCount, amountCents: plan.priceCents,
    payAmountCents: plan.priceCents, currency: plan.currency, paymentMethod: method,
    providerInstanceId: providerRow.id, providerKey: providerRow.providerKey,
    providerSnapshot: { id: providerRow.id, name: providerRow.name, providerKey: providerRow.providerKey, configEncrypted: providerRow.configEncrypted, paymentMode: providerRow.paymentMode },
    expiresAt, clientIp: getClientIP(event), sourceUrl: getHeader(event, 'referer') || null
  }).returning()
  if (!order) throw new Error('支付订单创建失败')
  try {
    const result = await provider.create({
      outTradeNo, amountCents: plan.priceCents, currency: plan.currency,
      subject: `${settings.productNamePrefix}${plan.name}${settings.productNameSuffix}`,
      method, notifyUrl: `${origin}/api/payment/webhook/${providerRow.providerKey}`,
      returnUrl: `${origin}/payment/result`, clientIp: getClientIP(event), mobile
    })
    const [updated] = await db.update(paymentOrders).set({
      paymentTradeNo: result.tradeNo || null, payUrl: result.payUrl || null,
      qrCode: result.qrCode || null, clientSecret: result.clientSecret || null,
      providerSnapshot: { ...order.providerSnapshot, checkout: result.extra || {} }, updatedAt: getServerDate()
    }).where(eq(paymentOrders.id, order.id)).returning()
    await addPaymentAudit(order.id, 'CREATED', { method, provider: providerRow.name })
    if (!updated) throw new Error('支付订单更新失败')
    return toPublicPaymentOrder(updated)
  } catch (error: any) {
    await db.update(paymentOrders).set({ status: 'FAILED', failedAt: getServerDate(), failedReason: error.message, updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
    await addPaymentAudit(order.id, 'CREATE_FAILED', { error: error.message })
    throw createApiError(502, SERVER_ERROR_CODES.PAYMENT_CREATE_FAILED, '创建支付订单失败')
  }
}

export const fulfillPaymentOrder = async (notification: PaymentNotification, operator = 'webhook') => {
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.outTradeNo, notification.outTradeNo)).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  if (notification.amountCents !== order.payAmountCents) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH, '支付金额与订单不一致')
  if (order.status === 'COMPLETED' || order.status === 'REFUNDED') return order
  if (!notification.success) {
    await db.update(paymentOrders).set({ status: 'FAILED', failedAt: getServerDate(), failedReason: '支付服务商返回失败', updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
    await addPaymentAudit(order.id, 'PAYMENT_FAILED', {}, operator)
    return order
  }
  await db.transaction(async tx => {
    const claimed = await tx.update(paymentOrders).set({ status: 'PAID', paymentTradeNo: notification.tradeNo || order.paymentTradeNo, paidAt: order.paidAt || getServerDate(), updatedAt: getServerDate() })
      .where(and(eq(paymentOrders.id, order.id), inArray(paymentOrders.status, ['PENDING', 'FAILED', 'EXPIRED']))).returning()
    if (!claimed.length && order.status !== 'PAID') return
    const existing = await tx.select({ value: count() }).from(paymentOrderCards).where(eq(paymentOrderCards.orderId, order.id))
    if (Number(existing[0]?.value || 0) === 0) {
      for (let index = 0; index < order.cardCount; index += 1) {
        const [card] = await tx.insert(cardCodes).values({ code: makeCardCode(), note: `支付订单 ${order.outTradeNo}` }).returning({ id: cardCodes.id })
        if (!card) throw new Error('点歌券生成失败')
        await tx.insert(paymentOrderCards).values({ orderId: order.id, cardCodeId: card.id })
      }
    }
    await tx.update(paymentOrders).set({ status: 'COMPLETED', completedAt: getServerDate(), updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
    await tx.insert(paymentAuditLogs).values({ orderId: order.id, action: 'FULFILLED', detail: { cardCount: order.cardCount }, operator })
  })
  const [completed] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id)).limit(1)
  if (!completed) throw new Error('支付订单履约后查询失败')
  return completed
}

export const getOrderProvider = async (order: typeof paymentOrders.$inferSelect) => {
  const [providerRow] = order.providerInstanceId
    ? await db.select().from(paymentProviderInstances).where(eq(paymentProviderInstances.id, order.providerInstanceId)).limit(1)
    : []
  const snapshot = order.providerSnapshot || {}
  const encrypted = typeof snapshot.configEncrypted === 'string' ? snapshot.configEncrypted : providerRow?.configEncrypted
  if (!encrypted) throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, '订单支付通道配置不存在')
  const providerKey = typeof snapshot.providerKey === 'string' ? snapshot.providerKey : order.providerKey
  const paymentMode = typeof snapshot.paymentMode === 'string' ? snapshot.paymentMode : providerRow?.paymentMode
  return { row: providerRow, provider: createPaymentProvider(providerKey, { ...decryptPaymentConfig(encrypted), paymentMode }) }
}

export const verifyPaymentOrder = async (orderId: string, userId?: number) => {
  const conditions = [eq(paymentOrders.id, orderId)]
  if (userId) conditions.push(eq(paymentOrders.userId, userId))
  const [order] = await db.select().from(paymentOrders).where(and(...conditions)).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  if (order.status === 'COMPLETED' || order.status === 'REFUNDED') return order
  const { provider } = await getOrderProvider(order)
  const result = await provider.query(order.outTradeNo, order.paymentTradeNo || undefined)
  if (result.status === 'paid') return fulfillPaymentOrder({ outTradeNo: order.outTradeNo, tradeNo: result.tradeNo, amountCents: result.amountCents || order.payAmountCents, success: true }, 'verify')
  return order
}

export const cancelPaymentOrder = async (orderId: string, userId: number) => {
  const settings = await getPaymentSettings()
  const [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, userId))).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  if (order.status !== 'PENDING') throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_ORDER_STATE_INVALID, '当前订单状态不可取消')
  if (settings.cancelLimitEnabled) {
    const since = getServerDate()
    since.setTime(since.getTime() - settings.cancelWindowMinutes * 60000)
    const [cancelled] = await db.select({ value: count() }).from(paymentAuditLogs)
      .innerJoin(paymentOrders, eq(paymentOrders.id, paymentAuditLogs.orderId))
      .where(and(eq(paymentOrders.userId, userId), eq(paymentAuditLogs.action, 'CANCELLED'), gte(paymentAuditLogs.createdAt, since)))
    if (Number(cancelled?.value || 0) >= settings.cancelMaxCount) throw createApiError(429, SERVER_ERROR_CODES.PAYMENT_CANCEL_LIMIT, '取消订单操作过于频繁')
  }
  const { provider } = await getOrderProvider(order)
  if (provider.cancel) await provider.cancel(order.outTradeNo, order.paymentTradeNo || undefined).catch(() => undefined)
  await db.update(paymentOrders).set({ status: 'CANCELLED', updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
  await addPaymentAudit(order.id, 'CANCELLED', {}, `user:${userId}`)
}

export const processPaymentRefund = async (orderId: string, amountCents: number, reason: string, operator: string) => {
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1)
  if (!order) throw createApiError(404, SERVER_ERROR_CODES.PAYMENT_ORDER_NOT_FOUND, '支付订单不存在')
  if (!['COMPLETED', 'REFUND_REQUESTED'].includes(order.status)) throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_ORDER_STATE_INVALID, '当前订单状态不可退款')
  if (amountCents !== order.payAmountCents - order.refundAmountCents) throw createApiError(400, SERVER_ERROR_CODES.PAYMENT_AMOUNT_INVALID, '点歌券套餐仅支持全额退款')
  const { row, provider } = await getOrderProvider(order)
  if (!row?.refundEnabled) throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_REFUND_UNSUPPORTED, '该通道未启用退款')
  const cards = await db.select({ id: cardCodes.id, status: cardCodes.status }).from(paymentOrderCards)
    .innerJoin(cardCodes, eq(cardCodes.id, paymentOrderCards.cardCodeId)).where(eq(paymentOrderCards.orderId, order.id))
  if (cards.some(card => card.status !== 'AVAILABLE')) throw createApiError(409, SERVER_ERROR_CODES.PAYMENT_BENEFIT_USED, '点歌券已使用，无法原路退款')
  await db.update(paymentOrders).set({ status: 'REFUNDING', refundReason: reason, updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
  try {
    const result = await provider.refund(order.outTradeNo, order.paymentTradeNo || undefined, amountCents, reason, order.payAmountCents)
    await db.transaction(async tx => {
      await tx.update(paymentOrders).set({ status: result.pending ? 'REFUNDING' : 'REFUNDED', refundAmountCents: order.refundAmountCents + amountCents, refundId: result.refundId || null, refundedAt: result.pending ? null : getServerDate(), updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
      if (!result.pending) await tx.update(cardCodes).set({ status: 'INVALID', updatedAt: getServerDate() }).where(inArray(cardCodes.id, cards.map(card => card.id)))
      await tx.insert(paymentAuditLogs).values({ orderId: order.id, action: result.pending ? 'REFUNDING' : 'REFUNDED', detail: { amountCents, reason }, operator })
    })
  } catch (error: any) {
    await db.update(paymentOrders).set({ status: 'COMPLETED', failedReason: error.message, updatedAt: getServerDate() }).where(eq(paymentOrders.id, order.id))
    await addPaymentAudit(order.id, 'REFUND_FAILED', { error: error.message }, operator)
    throw createApiError(502, SERVER_ERROR_CODES.PAYMENT_REFUND_FAILED, '退款请求失败')
  }
}

export const expirePaymentOrders = async () => {
  const candidates = await db.select().from(paymentOrders).where(and(eq(paymentOrders.status, 'PENDING'), lte(paymentOrders.expiresAt, getServerDate()))).limit(100)
  let expiredCount = 0
  for (const order of candidates) {
    try {
      const { provider } = await getOrderProvider(order)
      const result = await provider.query(order.outTradeNo, order.paymentTradeNo || undefined)
      if (result.status === 'paid') {
        await fulfillPaymentOrder({ outTradeNo: order.outTradeNo, tradeNo: result.tradeNo, amountCents: result.amountCents || order.payAmountCents, success: true }, 'expiry-check')
        continue
      }
    } catch (error: any) {
      console.warn(`支付订单 ${order.outTradeNo} 超时查单失败，保留待支付状态:`, error.message)
      continue
    }
    const updated = await db.update(paymentOrders).set({ status: 'EXPIRED', updatedAt: getServerDate() }).where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, 'PENDING'))).returning({ id: paymentOrders.id })
    if (updated.length) {
      expiredCount += 1
      await addPaymentAudit(order.id, 'EXPIRED')
    }
  }
  return expiredCount
}
